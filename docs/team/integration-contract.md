# Gate integration contract

- Status: Proposed for all five owners
- Last updated: 3 September 2026

## Frozen decisions

1. General-admission capacity uses one inventory row per event, not pre-created available-ticket rows.
2. Event publication creates the event and inventory row transactionally.
3. Claiming creates one reservation per attempt and uses one atomic database capacity update.
4. A ticket is created only after fake payment succeeds.
5. Payment is outside the reservation transaction and demonstrates success, failure, and a 30-second hang.
6. BullMQ schedules background work but never decides inventory availability.
7. A delayed expiry job is backed by a PostgreSQL overdue-reservation sweep.
8. Redis caches published event reads using bounded TTL plus explicit invalidation.
9. Roles are `attendee`, `staff`, and `admin`; anonymous access is limited to published browse routes.
10. The door is a browser PWA with a durable offline journal and idempotent batch reconciliation.

## Required handoffs

| Producer      | Contract                                                                     | Consumer                        |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| Events        | Published event and inventory initialization                                 | Inventory, Public browse        |
| Inventory     | Reserve/confirm/fail/expire functions and stable errors                      | Events/payment, Platform worker |
| Platform      | Auth context, route-limit primitives, job envelope, deployment and telemetry | All slices                      |
| Public browse | Public event projection and cache keys                                       | Events, Platform invalidation   |
| Check-in      | Ticket code, device identity, scan ID, batch and duplicate result            | Inventory, Platform             |

Every mutation documents its idempotency key, retry behavior, timeout behavior, and stable error codes. Every job documents producer, consumer, payload version, attempts, backoff, and duplicate behavior.

## Decisions still requiring named confirmation

- Reservation-window duration. It must exceed the 30-second fake-payment hang and remain configurable.
- Redis fail-open/fail-closed behavior for each endpoint category.
- Deployment provider and secret owner.
- Review assignments and ADR numbering.
- Whether staff/admin privileges need event-level membership rather than global scope.
- Final React/Vite frontend choice in ADR 0001.

## Review response

```text
Name and slice:
Accept or request changes:
Question:
Specific proposal:
Interface I provide:
Interface I consume:
Blocker or risk:
```
