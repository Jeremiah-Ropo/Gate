# ADR 0010: Public browse consumes Events' projection rather than caching its own

- Status: Proposed
- Owner: Jeremiah Patrick, Public browse
- Date: 9 September 2026
- Supersedes: an earlier draft of this decision (never merged) that had Public browse read Postgres directly and maintain its own Redis cache-aside layer over the whole event-plus-inventory payload.

## Context

Public browse needs to serve `GET /v1/events` and `GET /v1/events/:eventId` to anonymous visitors, fast enough to survive a ticket drop, without becoming a second path into the same tables Inventory's claim writes depend on.

An earlier version of this decision had this slice own that problem outright: read `events` and `events_inventory` directly, join them, and cache the whole result in Redis with a short TTL, accepting a few seconds of stale ticket counts as the price of one cache fetch per request. That version was written before checking what had already landed on `main`.

What has actually landed, merged through PRs #15 and #16, is `Modules/Event`'s own read model: `eventProjectionService`, exported from `Modules/Event/index.ts` with an explicit comment that it is "the surface other slices are allowed to depend on." It already does cache-aside on the event-owned fields (name, description, venue, `startsAt`), invalidated by a BullMQ job published after a committed event mutation rather than left to expire, and reads Inventory's counters live on every call rather than caching them — the split argued for in ADR 0004. `core/Routers.ts` states the ownership plainly in its own comment: "Anonymous published-event reads are not served here — the Public browse slice owns those and consumes the projection exported from Modules/Event."

So the question this ADR actually answers is narrower than the one it started as. It is not "how does browse cache published events" — that is answered, built, and tested by Events & Console. It is: given that projection already exists, what does Public browse still own, and how does it expose it anonymously.

## Decision

Public browse owns the anonymous HTTP surface and nothing about how the data underneath it is cached. `PublicBrowseService` calls `eventProjectionService.listPublished()` and `eventProjectionService.getPublishedById(id)` directly, does no independent Postgres or Redis access, and maintains no cache of its own. Its only job is reshaping the response: dropping `reserved`/`sold` (Inventory's internal bookkeeping, not something an anonymous visitor needs) and keeping `capacity`/`remaining`, which is enough to render availability.

The descriptor itself was extended as part of landing this ADR — `address`, `coverImage`, `ticketPrice` and `currency` were added to `IPublishedEventDescriptor`/`toDescriptor`, raised and resolved at the same time rather than left as a follow-up, since the gap blocked more than browse: the organiser console (`listForOrganiser`) shares the same descriptor and couldn't show or safely re-edit a price it never received back. The change is purely additive — new fields on an existing projection, no existing caller broken, no write-path or cache-key change — and lands with the tests it touches (`event-cache.test.ts`, `event-projection.service.test.ts`) updated to match.

Routes are mounted at `/v1/events` with no `AuthGuardMiddleware` anywhere on the router, rate-limited once at the mount via the shared `rateLimitPolicies.publicBrowse` policy (120 requests/minute, keyed by IP through the Redis-backed limiter Platform already built), matching how `/auth` is throttled at its mount rather than per route. A malformed event ID is rejected by validation before it reaches the projection service, so a bad ID costs a UUID check, not a cache lookup plus a possible Postgres query.

## Alternatives considered and rejected

**Keep the original design: read Postgres/Inventory directly and cache the whole projection in this slice.** This was the actual original plan, reversed once it became clear Events & Console had already built, tested, and merged a proper read model for exactly this purpose. Building a second one would mean two independently-cached views of the same events that can disagree with each other, doubles the Postgres load this ADR exists to avoid (one query path per cache, not one), and ignores a module boundary the rest of the codebase already documents and enforces. There was no remaining argument for it once the alternative was "this already exists and is tested."

**Cache the projection service's output again, one layer up, in this module.** Adding a second, shorter-TTL cache in front of `eventProjectionService` was considered as a middle ground — keep this slice's own performance story simple without duplicating Postgres access. Rejected because it buys nothing: `eventProjectionService` already serves from Redis on a hit, so a second cache in front of it adds a layer that is either redundant (same data, same freshness) or a second source of staleness with no invalidation signal of its own, which is the exact failure mode ADR 0004 was written to avoid.

## Consequences

**Accepted:**

- Extending another slice's descriptor from here, rather than filing the request and waiting, means Events & Console's projection changed on Public browse's say-so. Justified by the note already left in `Modules/Event/index.ts` explicitly inviting this request, and by the change being strictly additive — but it is still a decision this ADR makes on another slice's behalf, and should be confirmed at contract review rather than taken as settled just because it compiles.
- Public browse's read latency and cache-hit behavior are now entirely inherited from Events & Console's implementation. A regression in `eventProjectionService` is a regression here, with nothing in this slice to compensate.
- Inventory's counters are read live on every request regardless of how this slice feels about that cost — it is not this slice's call to make, per ADR 0004's own reasoning about where that decision belongs.

**Gained:**

- No second cache to keep consistent with the first. One system decides what a published event looks like; this slice only decides who is allowed to ask and how it's shaped for them.
- The module boundary `core/Routers.ts` already documents is now actually true in code, not just in a comment.
- This slice's entire implementation is a service that delegates, a controller, a validator and a route file — the smallest surface that satisfies "own the anonymous API," which is what this slice was assigned in the first place.

## Proof

`GET /v1/events` returns only published events, with no `AuthGuardMiddleware` on the router; a request with a valid bearer token and one with none behave identically. `GET /v1/events/:eventId` for a draft, a cancelled event, and a nonexistent ID all return the same 404 shape, sourced from `eventProjectionService.getPublishedById`'s own not-found handling. A malformed ID (`not-a-uuid`) returns a 422 before the projection service is called at all — verifiable by asserting the service is never invoked, not just that the HTTP status is correct. Neither route response contains `reserved` or `sold`. Sixty-one requests from one IP within a minute produce a 429 on the sixty-first, using the same Redis-backed store Platform's other rate limits use, confirmed by checking that the limiter's Redis keys use the `rate-limit:public-browse:` prefix.
