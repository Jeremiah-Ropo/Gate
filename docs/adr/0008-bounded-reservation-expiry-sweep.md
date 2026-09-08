# ADR 0008: Bound reservation expiry sweeps by rows and events

- Status: Proposed
- Owner: Awe, Ticket reservations
- Date: 8 September 2026

## Context

Pending reservations hold event inventory until they expire. Expiry must recover after worker or Redis outages, and multiple worker processes may sweep at the same time. A sweep therefore needs to claim rows without processing the same reservation twice.

Expiring reservations one at a time would require one inventory update per reservation. Inventory is tracked per event, so those releases can be grouped by event. The number of affected events must also be bounded so a single sweep cannot create an unbounded series of inventory updates.

## Decision

Each expiry sweep has two limits:

- `RESERVATION_EXPIRY_BATCH_SIZE` limits the number of reservations expired in one transaction.
- `RESERVATION_EXPIRY_MAX_EVENTS` limits the number of distinct events represented in that batch.

PostgreSQL selects the event IDs first, selects and locks overdue pending reservations belonging to those events with `FOR UPDATE SKIP LOCKED`, and expires the selected rows in one `UPDATE ... FROM ... RETURNING` statement. The service groups the returned reservations by event and performs one conditional inventory release per event in the same transaction.

The default limits are 100 reservations and 10 events. Therefore a successful sweep makes at most one reservation update and ten inventory updates, excluding transaction-control statements. Concurrent workers may select the same event, but row locks partition reservations between them and the inventory row update serializes the grouped releases.

## Alternatives rejected

- One update per reservation: simple, but creates unnecessary database calls and increases lock contention.
- A row-only batch limit: bounds expired rows but still allows one inventory update per row when every row belongs to a different event.
- Application-side selection followed by update: requires carrying a timestamp and ID list between statements and creates a race window that the database can avoid.
- One inventory update across all events: possible with a more complex aggregate update, but couples reservation expiry to a multi-event inventory mutation and is less clear than one update per event under the explicit cap.

## Consequences

The sweep has predictable database work and remains safe under duplicate or concurrent delivery. Events with locked rows may be processed partially or on a later sweep; the scheduler continues to retry. The two limits are operational settings and must be tuned together with the sweep interval and expected reservation volume.

## Proof

Create overdue reservations across more events than `RESERVATION_EXPIRY_MAX_EVENTS`, run a sweep, and verify that no more than the configured event count receives inventory updates. Run two sweep workers concurrently and verify that every reservation expires once and each event's reserved count is released exactly once. Replay a completed sweep and verify that it returns zero and makes no inventory changes.
