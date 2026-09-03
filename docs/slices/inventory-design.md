# Inventory slice design

- Status: Proposed for team review
- Owner: Dipepo
- Reviewer: Assigned outside Inventory before merge

## Problem and ownership

Inventory owns the ticket count and claim write path: everything that decides whether a claim succeeds. The slice must prove that a published capacity cannot be exceeded under concurrency, retries, duplicate requests, payment failure, or timeout.

## Design

Publishing an event creates one inventory row with `capacity`, `reserved`, and `sold`; it does not materialize one available-ticket row per unit. Availability is `capacity - reserved - sold`, with non-negative counters and `reserved + sold <= capacity` enforced.

An authenticated claim sends an idempotency key. One short PostgreSQL transaction conditionally reserves one unit and creates a pending reservation. A zero-row update returns `sold_out`. Payment is invoked only after commit. Success conditionally moves pending to paid, changes reserved to sold, and creates one ticket. Failure or expiry conditionally releases reserved inventory. Only a pending reservation may transition, so a payment/expiry race has one winner.

## Interface

- `reserve(eventId, attendeeId, idempotencyKey)` returns reservation ID, status, and `expiresAt`, or stable `sold_out`.
- `confirm(reservationId, paymentAttemptId)` creates a ticket once.
- `fail(reservationId, reason)` releases inventory once.
- `expire(reservationId, now)` releases inventory only after the deadline.
- Platform schedules expiry but calls these domain functions; it does not update counters itself.

## Failure and test plan

- Capacity 1 plus at least 20 concurrent claims yields one success.
- Reusing an idempotency key returns the original result.
- Duplicate confirm/fail/expire calls do not change counters twice.
- Payment success racing expiry results in exactly one terminal state.
- Redis/BullMQ outage does not permit overselling; overdue reservations are sweep-recoverable.
- Reconciliation detects disagreement between counters and reservation/ticket records.

## Deliberate cuts and open questions

No assigned seats, waitlist, real payment, or per-unit inventory slots. Confirm the reservation duration, schema status names, and capacity-change rules before implementation.

## AI disclosure

AI helped structure this review draft. The owner must verify the transaction, schema, measurements, and alternatives and revise the document in their own words before acceptance.
