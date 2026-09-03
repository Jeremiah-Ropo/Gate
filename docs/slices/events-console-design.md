# Events and console slice design

- Status: Proposed for team review
- Owner: Victor
- Reviewer: Assigned outside Events and console before merge

## Problem and ownership

Events and console owns the event read path and its caching, plus the thin read-only organiser console. Based on the current team canvas, it also coordinates event publication and the fake-payment demonstration. The team must explicitly confirm those two write responsibilities because the capstone slice wording names only the read path.

## Design

An admin/staff organiser publishes an event with validated title, venue/time, status, price metadata, and fixed capacity. Event creation and initial inventory creation occur in one transaction through the Inventory contract. Published event reads use a stable projection and cache-aside Redis key. Draft/cancelled data is excluded from the public projection.

The organiser console is read-only and shows event state, capacity, reserved, sold, available, and operational warnings such as overdue reservations. It calls the existing API rather than implementing business rules in the browser.

The fake payment adapter accepts a deterministic requested outcome: success, failure, or 30-second hang. It is called outside the reservation transaction. Its result invokes Inventory's conditional confirm/fail contract; it does not edit counters directly.

## Cache contract

- Published-event keys and payload version are documented for Public browse and Platform.
- Cache uses bounded TTL plus explicit invalidation after committed event changes.
- Cache miss reads PostgreSQL and repopulates.
- Redis failure behavior is explicit; stale drafts/unpublished events are never exposed.

## Failure and test plan

- Publication cannot leave an event without its inventory row.
- Anonymous reads never return draft/cancelled events.
- Cache miss/hit return the same public projection.
- Event update invalidates the exact affected keys.
- Success/failure/hang payment outcomes are deterministic and observable.
- Late success after expiry does not create a ticket.

## Deliberate cuts and open questions

No rich admin dashboard, charts, real payment, uploads, marketing UI, or notifications. Confirm publication/payment ownership, cache TTL, public projection fields, and organizer authorization scope.

## AI disclosure

AI helped structure this review draft. The owner must verify the ownership gap, cache contract, provider behavior, and tests before acceptance.
