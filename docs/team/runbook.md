# Gate 2 a.m. runbook

- Status: Initial team skeleton
- Audience: An engineer who did not attend the design sessions

## First response

1. Record the time, affected endpoint/event, correlation ID, deployment version, and reported symptom.
2. Check API liveness/readiness, worker heartbeat, PostgreSQL connectivity, Redis connectivity, queue age/depth, and recent error-rate change.
3. Determine whether the failure affects reads, claims, payment completion, background expiry, or door reconciliation.
4. Preserve logs and measurements before restarting anything.
5. Prefer safe degradation: PostgreSQL correctness must remain intact even if cache or workers are unavailable.

## Symptom guide

| Symptom                      | Inspect                                             | Safe first action                                                                     |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Claims return errors         | API errors, DB pool, lock wait, inventory invariant | Stop unsafe writes only if correctness is uncertain; do not switch authority to Redis |
| Reservations remain pending  | Worker heartbeat, queue age, overdue count          | Restart worker, then run the documented idempotent sweep                              |
| Public browse is stale       | Cache age/key, invalidation failures, DB read       | Invalidate affected public cache key; retain DB fallback                              |
| Door sync retries/duplicates | Device ID, batch ID, client scan IDs                | Replay the same batch; never delete dedupe records to force success                   |
| Redis unavailable            | Endpoint policy, API/worker logs                    | Preserve DB-backed correctness; restore Redis and observe catch-up                    |

## Inventory checks

- Compare event capacity with reserved and sold counters.
- Compare active reservations with the recorded reserved count.
- Find pending reservations older than their `expiresAt`.
- Never edit counters without a reviewed reconciliation procedure and an audit record.

## Restart order

1. Confirm PostgreSQL is healthy.
2. Restore Redis.
3. Start the API and verify readiness.
4. Start the worker and verify heartbeat.
5. Observe queue catch-up and overdue-reservation count.
6. Run one public browse, claim, and check-in smoke test.

## Escalation and closeout

Escalate immediately if capacity may have been exceeded, a ticket may have been admitted twice, or offline reconciliation loses scans. After recovery, record symptom, measurements, root cause, what the evidence contradicted, correction, and prevention. Create the required team post-mortem only for an actual incident.

## Render operations

- API health: open the `gate-api` service and check `/health/live` and `/health/ready`.
- API evidence: filter the `gate-api` logs by request ID and deployed commit.
- Worker evidence: inspect `gate-worker` logs for startup, job failure, and graceful-shutdown messages.
- Data evidence: inspect `gate-db` connections/storage and `gate-queue` connections/memory in their Metrics pages.
- Rollback: redeploy the previous successful API and worker revisions. Do not reverse a migration without its reviewed recovery procedure.
- Deployment owner: Platform owner. Domain failures remain owned by the engineer responsible for that slice.

The complete deployment and acceptance procedure is in `docs/deployment/render.md`.
