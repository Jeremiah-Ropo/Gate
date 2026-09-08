# ADR 0009: Recover stale payments through a durable provider stub

- Status: Proposed
- Owner: Awe, Ticket reservations
- Date: 8 September 2026

## Context

The reservation service can lose the result of a payment request after the provider accepts it. A process restart, a request timeout, or a worker interruption can leave a reservation in `payment_processing` even though the provider has already settled the payment. The local payment attempt is durable, but the development provider previously kept its state in memory, so a restart made reconciliation impossible.

Payment-provider state is owned by the provider boundary. The reservation module must use the provider interface to ask for a status; it must not read the provider's backing table directly.

## Decision

Persist the stub provider's requests in `stub_payment_requests`, including the provider reference, status, failure reason, and delayed completion time. The provider implementation is the only application component that reads or writes this table. A new provider instance therefore observes the same request state as the instance that created it.

Run a periodic BullMQ recovery job. Each recovery attempt claims at most one stale local payment attempt, and the scheduled job drains the currently eligible attempts by repeating until an attempt returns `none`:

1. PostgreSQL locks one expired `payment_processing` attempt with `FOR UPDATE SKIP LOCKED` and writes a short recovery lease.
2. After the transaction commits, the worker asks the provider for the request status. Network or provider errors leave the attempt processing; the lease expiry makes it eligible for a later retry.
3. `succeeded` uses the existing paid-reservation transition, while `failed` uses the existing failed-payment transition. Both transitions are conditional and idempotent, so a lease expiry or duplicate worker cannot issue a second ticket or release inventory twice.
4. `processing` makes no local state transition; the next sweep retries after the lease expires. A missing provider request (`null`) is treated as failed because the provider has no durable record that the payment reached it.

The provider lookup is deliberately outside the database transaction. A provider call must not hold a PostgreSQL row lock while waiting on network I/O, and the lease provides bounded ownership of the recovery attempt instead.

## Alternatives rejected

- Keep provider requests in memory: a restart loses the only copy of provider state and makes reconciliation depend on process lifetime.
- Read the provider table from the reservation service: this couples the reservation slice to a provider implementation and makes a future real provider migration harder.
- Hold the PostgreSQL claim transaction open during the provider call: a slow or unavailable provider would hold row locks and reduce recovery throughput.
- Mark every provider error as failed: an unknown outcome can represent a charge that succeeded; failing locally would make the reservation and provider disagree.
- Claim a batch of stale payments: each recovery requires an individual provider status lookup, so one claim per attempt keeps external work independent while the worker can still drain a backlog.

## Consequences

The local database now retains enough state to recover a payment across API and worker restarts. Recovery latency is bounded by the sweep interval, the claim lease, and the provider response time. Each recovery attempt performs at most one provider status lookup and one local finalization transaction. A scheduled job repeats those bounded attempts until no stale payment is available. The provider stub table is test infrastructure, not a replacement for a production provider's durable API or webhook contract.

## Proof

Use PostgreSQL-backed tests to verify that a fresh provider instance can read a request created by another instance, that succeeded and failed provider states finalize the reservation correctly, that processing remains processing, and that concurrent recovery calls claim one stale attempt only once while issuing one ticket.
