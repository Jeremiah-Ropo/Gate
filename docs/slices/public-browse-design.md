# Public browse slice design

- Status: Proposed for team review
- Owner: Jeremiah
- Reviewer: Assigned outside Public browse before merge

## Problem and ownership

Public browse owns the browse-without-an-account path end to end: anonymous API, caching integration, and thin web surface. It must remain fast and usable without weakening the rule that claiming requires authentication.

## Design

Expose list and detail endpoints that return only the versioned published-event projection agreed with Events and console. The public router is mounted before authentication; every claim or user-specific route remains protected. Cursor pagination and bounded limits prevent unbounded reads.

The endpoint consumes the Events read/cache contract: Redis cache-aside lookup, PostgreSQL on miss, bounded TTL, and explicit invalidation after event changes. Inventory counters shown publicly are advisory display values only; claim success is always decided by Inventory's atomic PostgreSQL write.

The surface renders event title, venue/time, published availability state, and a claim action. Selecting claim sends an anonymous user to authentication and returns them to the event afterwards. Do not store privileged event or user data in browser caches.

## Failure and test plan

- Anonymous list/detail succeeds without a token.
- Draft, cancelled, and private fields never appear.
- Claim without authentication returns `401` rather than creating state.
- Cache miss/hit produce equivalent responses.
- Stale cache is bounded and invalidated after publication/update/cancellation.
- Redis failure follows the agreed degradation policy and is observable.
- Pagination limits and public rate limits are enforced.

## Deliberate cuts and open questions

No marketing page, design system, animation, search engine, recommendations, or custom dashboard. Confirm the public projection, cache TTL, pagination size, Redis failure policy, and frontend stack.

## AI disclosure

AI helped structure this review draft. The owner must verify the anonymous security boundary, cache behavior, public payload, and surface before acceptance.
