# ADR 0002: Represent general-admission inventory with one atomic counter row

- Status: Proposed
- Owner: Dipepo, Inventory
- Date: 3 September 2026

## Context

An event publishes a fixed capacity and may sell out under concurrent requests. Gate has general admission, not assigned seats. Creating hundreds of unused ticket rows would add lifecycle and storage work without giving those units a required identity.

## Decision

Create one event-inventory row containing capacity, reserved, and sold counters. Derive availability as capacity minus reserved minus sold. Reserve with one conditional PostgreSQL update and insert the reservation in the same short transaction. Payment occurs after commit. Confirm, fail, and expire are conditional, idempotent transitions that adjust the reservation and counters transactionally. Create a ticket only after confirmation.

## Alternatives rejected

- Pre-create one slot per ticket: useful for assigned seating or per-unit identity, neither of which is required. It adds generation, indexing, counting, and expiry complexity.
- Store the authoritative count in Redis: eviction/failover could separate capacity from durable reservations and tickets.
- Read then update in application code: two callers can both observe the final unit; the check and mutation must be atomic.

## Consequences

One popular event creates a hot row, so lock wait and claim latency must be measured. Every terminal transition must preserve non-negative counters and `reserved + sold <= capacity`. Reservations and tickets provide the audit trail. The approach must be reconsidered for assigned seating, channel allocation, per-unit pricing, or measured unacceptable contention.

## Proof

Capacity 1 with at least 20 concurrent requests yields one reservation. Duplicate requests/transitions do not change counters twice. Payment racing expiry yields one terminal state. Redis/BullMQ failure cannot permit overselling.
