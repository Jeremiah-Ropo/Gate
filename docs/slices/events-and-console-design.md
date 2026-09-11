# Slice design — Events and console

**Owner:** Victor Emeke · **Status:** merged (#15, #16) · **Date:** 2026-09-11

## What this slice owns

- Event creation and publication, including fixing the ticket count at publication
- The published-event read model — the projection every other slice reads events through
- The read-only organiser console
- Cache invalidation semantics for event reads

## What it does not own

| Concern                                                                         | Owner         |
| ------------------------------------------------------------------------------- | ------------- |
| Capacity and the reserved/remaining/sold counters, reservations, issued tickets | Inventory     |
| The anonymous published-event API and browser surface                           | Public browse |
| Accounts, roles, runtime, job delivery and telemetry                            | Platform      |
| Door flow, offline journal, sync reconciliation                                 | Check-in      |

This slice serves **no anonymous HTTP**. Public browse owns those endpoints and consumes the
projection as an in-process contract.

## Contract other slices depend on

`src/Modules/Event/index.ts` is the only supported entry point. Anything not re-exported there is
internal and may change without notice.

```ts
import { eventProjectionService, IPublishedEventProjection } from "Modules/Event";

eventProjectionService.listPublished(); // published events, soonest first
eventProjectionService.getPublishedById(id); // 404s for anything not published
eventProjectionService.listForOrganiser(userId); // console rows, drafts included
```

`IPublishedEventProjection` carries `id, name, description, venue, address, coverImage, startsAt,
ticketPrice, currency` from `events`, plus `capacity, reserved, remaining, sold` from
`events_inventory`. `slug` and `createdBy` stay out — a column added to the table is opt-in to the
contract, never leaked into it by default.

**Revised after review:** the contract originally excluded `address`, `coverImage`, `ticketPrice`
and `currency`. Public browse asked for them (raised via the note in `Modules/Event/index.ts`) —
browse needs to show a price and an organiser cannot edit what they cannot see. All four are set at
publish and only change through an event mutation, so they carry the same invalidation guarantee as
the rest of the descriptor and were safe to add.

## Data ownership

Every number describing stock lives in Inventory's `events_inventory` row: `capacity`, `reserved`,
`sold`, and `remaining`, which Postgres generates as `capacity - reserved - sold`. Events reads them
through Inventory's own `IEventInventoryRepository` and never writes a counter. This slice added
`findByEventIds` to that repository so a catalogue listing costs one query rather than one per
event — flagged for Inventory's review as a change to a shared dependency.

Events does set `capacity` once, at publication, by calling `inventory.withTx(tx).create(...)`
inside the same transaction as the event — Inventory's schema requires that row to exist from the
start. After that there is no path in this slice to change it; altering capacity is an Inventory
operation.

When Inventory cannot be read, the counters project as **`null`, meaning unknown — never `0`, which
would read as sold out**.

## Read path

Reads are cache-aside over Redis, but only over the fields this slice mutates:

| Field group                         | Source                             | Why                                                             |
| ----------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| name, description, venue, startsAt  | Redis, falling back to Postgres    | Only Events changes these, so Events can invalidate them        |
| capacity, reserved, remaining, sold | Inventory, read live every request | These move on claims, which produce no invalidation signal here |

Keys are `events:published:list` and `events:published:<id>`, with a **5-minute** TTL that is a
backstop, not the freshness mechanism. A committed mutation clears the cache **inline** and also
publishes the invalidation job; the inline delete is what readers depend on, and the job is the
half that survives a Redis blip because it retries with backoff.

**Revised twice, and the second time by production.** The TTL started at 15 minutes and was raised
to 24 hours once invalidation looked proven — a short TTL had been quietly doing invalidation's job
and masking the bug where no job was ever queued. That reasoning was right about tests and wrong
about deployment: the worker consuming the queue is a free-plan instance that spins down after
about fifteen minutes without inbound traffic, and nothing sends it any. Measured in production, it
took 35.7s to answer while cold against 0.59s warm, and drained eight queued jobs in the twenty
seconds after waking. So invalidation was not running, the 24-hour TTL _was_ the freshness
mechanism after all, and raising it had made the stale window far worse.

The fix takes the sleeping process off the read path: the API clears the keys itself, and the TTL
drops to 5 minutes as a genuine backstop. A miss costs one `listPublished` query, and Inventory's
counters were already read live on every request, so the cost of missing is small. Publication status is part of the
SQL predicate, so a draft is indistinguishable from a missing row and can never be cached as public.

The console bypasses the cache entirely: an organiser needs current truth, and the console includes
drafts, which never belong in a published cache. Its responses are `private, no-cache` so a shared
cache never holds one organiser's numbers.

Reasoning is recorded in [ADR 0004](../adr/0004-events-read-model-caching.md).

## Write path

| Method | Path                 | Auth                             |
| ------ | -------------------- | -------------------------------- |
| POST   | `/v1/event/publish`  | staff/admin                      |
| POST   | `/v1/event`          | staff/admin (creates a draft)    |
| PUT    | `/v1/event/:eventId` | staff/admin                      |
| DELETE | `/v1/event/:eventId` | staff/admin (cancels, see below) |
| GET    | `/v1/console`        | none (shell only, holds no data) |
| GET    | `/v1/console/events` | staff/admin                      |

Two rules protect that transaction:

- **Edits are built from an allowlist**, never from spreading the request body. Review reproduced
  reassigning `createdBy` to take over another organiser's event; anything not explicitly named is
  now ignored, so a new column is opt-in to editing rather than editable by default.
- **An ordinary edit cannot set status to `published`** (409). Publishing that way would skip the
  transaction above and leave an event on the public catalogue with no inventory row, which nobody
  could ever claim a ticket for. Other transitions, such as cancelling, still work.

After a mutation **commits**, the service queues an `event-cache-invalidate` job on
`event-cache-queue`. Publishing before commit is the bug this ordering exists to prevent: a
rolled-back write could otherwise evict a valid entry, or have the worker read the pre-commit row
back into the cache. The job id is stable per commit, so a duplicate publish collapses instead of
queueing twice, and the handler only deletes keys — deleting an absent key is a no-op, which is what
makes retries safe.

## Failure behaviour

| Failure                             | Behaviour                                                          |
| ----------------------------------- | ------------------------------------------------------------------ |
| Redis unreachable on read or write  | Degrades to a miss; browse falls back to Postgres and still serves |
| Inline invalidation fails           | Logged, not awaited; the queued job is the retrying second attempt |
| Invalidation job fails              | Propagates so BullMQ retries; TTL is the last-resort backstop      |
| Worker asleep or down               | Inline delete already cleared the keys; the job drains on wake     |
| Invalidation cannot be queued       | Logged, request still succeeds — the write is already durable      |
| Inventory row missing or unreadable | Counters project as `null`; the event still lists                  |

Postgres decides publication authority in every case. Redis only makes it faster.

## Testing

Tests run with no Postgres, Redis or Inventory present. Collaborators are constructor arguments, so
the read paths run against in-memory fakes; the cache tests stub Redis into failure to prove the
fallback rather than assuming it.

## Known gaps and open questions

- ~~Who creates the inventory row?~~ **Answered.** Inventory shipped `IEventInventoryRepository`
  with `withTx`, so publish calls into their code rather than inserting into their table.
- `findByEventIds` was added to Inventory's repository by this slice; Inventory should confirm they
  are happy owning it.
- Public browse needs its own URL prefix for anonymous reads. This slice deliberately stays on
  `/v1/event`, matching main and the frontend's `lib/api.ts`, so nothing here has to be
  renamed for browse to land.
- ~~`coverImage` is not in the projection~~ **Resolved.** Browse asked for it; `address`,
  `coverImage`, `ticketPrice` and `currency` are now in the descriptor.
- ~~`main` does not compile~~ **Resolved.** The schema fallout from #3 is fixed across all slices;
  `yarn tsc` is clean and the suite runs. The report is kept as the record:
  [bug report 0001](../bug-reports/0001-schema-change-breaks-five-slices.md).
- **Delete is a status transition, not a row delete.** Ticket and reservation rows reference the
  event with `ON DELETE no action`, so `DELETE /v1/event/:id` moves it to `cancelled`: it leaves the
  public catalogue, and the organiser console still shows it. A hard delete would either fail on the
  foreign key or orphan issued tickets.
- **The imported frontend is not yet wired to this API.** It runs on preview/mock data and reads
  `event.startsAt`, while the raw event endpoints return `starts_at` from Dipepo's #3 rename. The
  projection uses `startsAt`, so browse consuming it closes the gap — worth confirming with Public
  browse before demo.

## Where AI was used

Claude (Claude Code) drafted this slice's implementation, its tests and these documents. What I
checked by hand rather than took on trust: the Helmet CSP behaviour, probed against the real
`helmet()` middleware instead of read off the docs; the BullMQ job-id bug, confirmed by mutation —
restoring the old colon format fails the test; the Redis degradation path, exercised by stubbing
`RedisManager` into failure rather than asserting it degrades; and the frontend contract mismatch,
found by reading `frontend/src/lib/api.ts` directly. The staleness bugs in this document — a TTL
figure that has now been wrong twice, and a contract field list that had gained four fields — were
caught the same way, by diffing the prose against the code rather than re-reading the prose. The
thing AI did _not_ catch is the one that mattered most: that the queue worker was asleep in
production. No amount of reading the code would have shown that; it took measuring the deployed
service.
