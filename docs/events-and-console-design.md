# Slice design — Events and console

**Owner:** Victor Emeke · **Status:** for review · **Date:** 2026-09-04

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

`IPublishedEventProjection` carries `id, name, description, venue, startsAt` from `events`, plus
`capacity, reserved, remaining, sold` from `events_inventory`. `coverImage`, `slug`, `ticketPrice`
and `createdBy` are deliberately excluded — a column added to the table is opt-in to the contract,
never leaked into it by default.

## Data ownership

Every number describing stock lives in Inventory's `events_inventory` row: `capacity`, `reserved`,
`sold`, and `remaining`, which Postgres generates as `capacity - reserved - sold`. Events reads them
through `IEventInventoryReader` and never writes a counter.

Events does set `capacity` once, at publication, by creating the inventory row in the same
transaction as the event — Inventory's schema requires that row to exist from the start. After that
there is no path in this slice to change it; altering capacity is an Inventory operation.

When Inventory cannot be read, the counters project as **`null`, meaning unknown — never `0`, which
would read as sold out**.

## Read path

Reads are cache-aside over Redis, but only over the fields this slice mutates:

| Field group                         | Source                             | Why                                                             |
| ----------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| name, description, venue, startsAt  | Redis, falling back to Postgres    | Only Events changes these, so Events can invalidate them        |
| capacity, reserved, remaining, sold | Inventory, read live every request | These move on claims, which produce no invalidation signal here |

Keys are `events:published:list` and `events:published:<id>`, with a 15-minute TTL that is a
backstop for a lost invalidation job, not the freshness mechanism. Publication status is part of the
SQL predicate, so a draft is indistinguishable from a missing row and can never be cached as public.

The console bypasses the cache entirely: an organiser needs current truth, and the console includes
drafts, which never belong in a published cache. Its responses are `private, no-cache` so a shared
cache never holds one organiser's numbers.

Reasoning is recorded in [ADR 0004](adr/0004-events-read-model-caching.md).

## Write path

| Method | Path                  | Auth                             |
| ------ | --------------------- | -------------------------------- |
| POST   | `/v1/events/publish`  | staff/admin                      |
| POST   | `/v1/events`          | staff/admin (creates a draft)    |
| PUT    | `/v1/events/:eventId` | staff/admin                      |
| GET    | `/v1/console`         | none (shell only, holds no data) |
| GET    | `/v1/console/events`  | staff/admin                      |

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
| Invalidation job fails              | Propagates so BullMQ retries; TTL is the last-resort backstop      |
| Invalidation cannot be queued       | Logged, request still succeeds — the write is already durable      |
| Inventory row missing or unreadable | Counters project as `null`; the event still lists                  |

Postgres decides publication authority in every case. Redis only makes it faster.

## Testing

Tests run with no Postgres, Redis or Inventory present. Collaborators are constructor arguments, so
the read paths run against in-memory fakes; the cache tests stub Redis into failure to prove the
fallback rather than assuming it.

## Known gaps and open questions

- **Who creates the inventory row?** This slice writes it directly inside the publish transaction,
  behind `IEventInventoryWriter`. Inventory's schema comment requires the row to exist from the
  start but exposes no method to call. If Inventory would rather own that write, it is a one-line
  swap of the implementation.
- Public browse needs a URL prefix that does not collide with `/v1/events` — for API contract review.
- `coverImage` is not in the projection; ask if browse needs it.
- `main` currently does not compile: four other slices still reference columns removed in #3. See
  [the bug report](bug-reports/0001-schema-change-breaks-five-slices.md).
