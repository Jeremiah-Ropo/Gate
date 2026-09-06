# ADR 0003: Run background workers separately with delayed jobs and recovery sweeps

- Status: Proposed
- Owner: Ibukun, Platform
- Date: 3 September 2026

## Context

Gate needs background reservation expiry and cache invalidation. BullMQ delivery can be delayed, duplicated, or unavailable. The current API starts all workers in-process, so scaling/restarting the API also changes or interrupts background consumers. Inventory correctness belongs to the Inventory slice, not Platform.

## Decision

Run the Express API and BullMQ worker as separate processes from the same TypeScript build. Platform owns the queue connection, job envelope, attempts/backoff, process lifecycle, health, logs, and metrics. Domain owners provide idempotent handlers.

Schedule one delayed expiry job per reservation and run a periodic PostgreSQL sweep for overdue pending reservations. Both call Inventory's conditional `expire` function. Cache invalidation similarly calls the cache owner's handler after a committed event change. PostgreSQL remains the recovery source; the worker never implements ticket-counter rules.

## Alternatives rejected

- Workers inside every API process: replica count would silently become consumer count, request and job resources would compete, and API restarts would interrupt work.
- Queue every ticket claim: queue delay becomes checkout latency and Redis outage stops claims while database correctness is still required.
- Delayed jobs without a sweep: a missed enqueue or prolonged outage can hold inventory indefinitely.
- Sweep only with no queue: simple but increases recovery delay and repeated database scanning; BullMQ is already present.

## Consequences

API and worker deploy/restart independently and require separate health evidence. Jobs carry stable entity and correlation IDs, not sensitive records. Duplicate delivery is expected. The sweep closes enqueue-after-commit gaps. Redis failure degrades background timing but cannot weaken Inventory's PostgreSQL invariant.

## Proof

Start/stop API and worker independently. Deliver one job twice and observe one domain transition. Stop Redis, create an overdue database state through a test fixture, restore the worker, and verify sweep recovery. Correlate initiating request and worker logs.
