# ADR 0004 — Cache event-owned fields, read inventory counters live

**Status:** proposed, for review before implementation merges
**Owner:** Victor Emeke (Events and console)
**Date:** 2026-09-04
**Affects:** Public browse (consumes the projection), Inventory (read on every projection request)

> Numbered 0004 in the team ADR log.

## Context

The system map assigns this slice the published-event read model and the cache invalidation
semantics for event reads. Browse is expected to be the highest-traffic path in the system, so those
reads want a cache.

The projection mixes two kinds of field with opposite change profiles:

- **Event-owned fields** — name, description, venue, `starts_at`. Only this slice writes them, and
  only through publication or an edit.
- **Inventory's row** — capacity, reserved, sold, and the generated `remaining`. These live in
  `events_inventory` and move on every claim, and claims happen in Inventory.

Cache invalidation here is driven by a BullMQ job published after a committed _event_ mutation. That
gives this slice a signal for the first group and **no signal at all** for the second: nothing tells
Events that a customer just claimed a ticket.

The agreed system invariant is that Postgres, not a cached view, decides claim correctness — caches
may be stale, and staleness must never be allowed to weaken that.

## Decision

Cache only the event-owned fields. Fetch Inventory's counters live on every projection request and
merge them in at read time.

Concretely: `events:published:list` and `events:published:<id>` hold an event descriptor holding
nothing from `events_inventory`, invalidated by the job published after an event mutation commits,
with a 15-minute TTL as a backstop for a lost job. Capacity and the counters are read through
`IEventInventoryReader` on each call and project as `null` when Inventory cannot be read — never as
`0`, which would read as sold out.

Capacity is included in the live read rather than the cache even though it never changes after
publication, because it lives in Inventory's row. Splitting one row across two freshness models to
save a field is not worth the seam.

The organiser console bypasses the cache entirely, since it must show current truth and includes
drafts, which never belong in a published cache.

## Alternatives considered and rejected

### 1. Cache the whole projection, including counters, with TTL as the freshness mechanism

Simplest and fastest: one cache entry serves a browse request outright, with no inventory lookup.

**Rejected because the counters would be knowably wrong and nothing would clear them.** No event
mutation accompanies a claim, so the only thing expiring a stale count is the TTL. At 15 minutes a
sold-out event keeps advertising availability for 15 minutes. Shortening the TTL to seconds does not
fix it — it just narrows the window while reducing the cache to a thin veneer over the database. It
also puts this slice in the position of publishing a number it knows may be false at the exact moment
a user decides to claim, which is the confusion the system invariant exists to prevent.

### 2. Have Inventory publish a cache-invalidation event on every claim

Would keep counters cached and still correct, by giving this slice the missing signal.

**Rejected on ownership and on load.** It makes Inventory responsible for maintaining another
slice's cache, inverting the ownership the system map assigns; Events would no longer own its own
invalidation semantics in any meaningful sense. It also adds a queue hop to the hot claim path, which
Inventory must keep short and transactional. And since any claim changes the published list, every
claim would evict the list — under the load that motivates caching at all, entries would be evicted
faster than they could be filled.

### 3. No server-side cache — HTTP `Cache-Control` and ETag only

This was the original plan for the slice, and it needs no Redis at all.

**Rejected because `max-age` is expiry, not invalidation.** Once a response is in a browser or CDN
cache there is no way to clear it after a committed mutation; a newly published event simply does not
appear until the window lapses. It also leaves Public browse with no invalidation contract to build
against, and does not discharge the responsibility the system map assigns this slice. HTTP caching is
retained only for the console, where `private, no-cache` plus an ETag is exactly right.

### 4. Keep a `remaining_tickets` column on `events` and cache it with everything else

Would make the counter event-owned by definition, and therefore cacheable and invalidatable by this
slice — the shape this slice was originally built with.

**Rejected because it duplicates data Inventory owns and enforces.** `events_inventory` generates
`remaining` as `capacity - reserved - sold` and constrains `reserved + sold <= capacity` in the
database; a second copy on `events` carries no such guarantee and can silently drift from the
authoritative one, which is precisely the class of bug those constraints exist to exclude.

This one is settled by events rather than argument: the column was built, and Inventory's schema
landed in #3 with the counters where they belong. The column has since been removed.

## Consequences

**Accepted:**

- An inventory read sits behind every browse request. This is the main cost and the open question below.
- The descriptor cache is only as correct as the invalidation job. A lost job leaves a stale name or
  date for up to the TTL — low harm, and the reason the TTL exists.
- Two reads per request instead of one, so the projection is slightly more complex than a single
  cache fetch.

**Gained:**

- A stale ticket count cannot be served, because the count is never cached.
- The cache is invalidated by exactly the mutations this slice owns, so the ownership boundary and
  the invalidation boundary are the same line.
- A Redis outage degrades browse to a Postgres read rather than failing it.
- Drafts can never enter the published cache, since publication status is part of the query.

## Open question, with a proposal

**Question for Inventory:** is a counter read per browse request acceptable load on `events_inventory`?

**Proposal if not:** Inventory exposes a read-optimised counter endpoint and states a freshness
window it is willing to stand behind. Events caches counters only within that window, with Inventory
owning its semantics. That keeps the authority for the number where it belongs and avoids this slice
inventing a staleness budget for data it does not own.
