# ADR 0006: Reconcile an idempotent offline scan journal using stable client scan IDs

- Status: Proposed, partially superseded by ADR 0007
- Owner: Timilehin, Check-in
- Date: 3 September 2026

## Context

The door must operate during a network outage and must not admit the same ticket twice. A phone browser may retry, reconnect, or be killed mid-write. Multiple offline doors cannot coordinate through the server while disconnected.

## Decision

Persist every scan to IndexedDB before reporting it as recorded. Give each scan a stable client-generated ID and retain it until the server acknowledges a result. Reconcile bounded batches. PostgreSQL uniquely records client scan IDs and applies an idempotent ticket check-in transition, returning a per-scan result that can be replayed.

Allocate non-overlapping offline ticket/door partitions, or another explicitly reviewed authority rule, so two disconnected doors cannot both locally authorize the same ticket. Store only public verification material on the device; signing secrets remain server-side.

> **Superseded by ADR 0007.** The partitioning sentence above no longer holds: general admission provides no basis for routing an attendee to the door that owns their ticket. Double admission is now detected on sync and surfaced, not prevented at the door — and it is not limited to disconnected doors, since a door admits on its local decision, so two online doors can also overlap before either has synced. Everything else in this ADR stands.

## Alternatives rejected

- Require connectivity: violates the core requirement.
- Store pending scans only in memory: browser termination loses admissions.
- Last-write-wins reconciliation: can conceal double admission after it physically happened.
- Put a signing secret in the PWA: any device compromise would expose system-wide authority.

## Consequences

Offline decisions are limited by the downloaded dataset. Clock skew, dataset freshness, and retention become explicit operational concerns. Replaying a batch is safe; a partial response leaves unacknowledged scans pending.

> Partition wording removed, per ADR 0007. Device registration, revocation and key rotation are also gone: a door device is no longer registered hardware but a logged-in staff member with an active event membership, so access is withdrawn by changing that membership.

## Proof

Test duplicate online calls, repeated batches, kill-before-send, kill-after-send, partial response, two-door conflict, revoked membership, and delayed server response. Key rotation is no longer in scope: the device holds no credential to rotate.
