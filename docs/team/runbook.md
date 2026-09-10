# Gate 2 a.m. runbook

- **Owner:** Ibukun / Platform
- **Audience:** An engineer who did not attend the design sessions
- **Last verified:** 2026-09-10 against Render `deploy/live-render`

## Live resources

| Resource | URL / ID |
| --- | --- |
| **API** | https://gate-api-0dl0.onrender.com |
| **Web** | https://gate-web-vxp3.onrender.com |
| **Worker** | https://gate-worker.onrender.com (HTTP wrapper only; jobs run in-process) |
| **Postgres** | `gate-db` — `dpg-dahareht0dsc73fadkug-a` |
| **Redis** | `gate-queue` — `red-dahareajnfac7391tps0` |
| **Render dashboards** | API `srv-dahascp5efls738oe8p0`, worker `srv-dahasmek1f9s73ebcjvg`, web `srv-dahasg6k1f9s73ebbqpg` |

## First response

1. Record the time, affected endpoint/event, **correlation ID** (`X-Request-Id`), deployment version, and reported symptom.
2. Check API liveness/readiness/metrics, worker heartbeat, PostgreSQL connectivity, Redis connectivity, queue depth, and recent error-rate change.
3. Determine whether the failure affects reads, claims, payment completion, background expiry, or door reconciliation.
4. Preserve logs and measurements before restarting anything.
5. Prefer safe degradation: PostgreSQL correctness must remain intact even if cache or workers are unavailable.

## Quick health checks

```bash
# Liveness — no dependency calls
curl -sS -D - https://gate-api-0dl0.onrender.com/health/live -o /dev/null

# Readiness — Postgres, Redis, BullMQ must respond within 2s
curl -sS https://gate-api-0dl0.onrender.com/health/ready

# Operational snapshot (JSON counters, no dashboard)
curl -sS https://gate-api-0dl0.onrender.com/health/metrics | jq .
```

Expected `/health/metrics` keys:

- `http.requests`, `http.errors`, `http.status401`, `http.status403`, `http.status429`
- `queues.event-cache-queue` and `queues.ticket-reservation-maintenance` — each with `waiting`, `active`, `delayed`, `failed`
- `worker.heartbeatAt`, `worker.jobsCompleted`, `worker.jobsFailed`
- `reservations.overduePending`

**Stale worker signal:** `worker.heartbeatAt` missing or older than **2×** `RESERVATION_EXPIRY_SWEEP_INTERVAL_MS` (default 10s). Inspect `gate-worker` logs and Redis key `gate:worker:heartbeat`.

## Correlating API requests with worker jobs

Every API response includes `X-Request-Id`. Authenticated mutations that enqueue cache invalidation copy that id onto the BullMQ job field `correlationId`.

### Proof procedure (acceptance)

1. Call a mutating endpoint and capture the response header:

```bash
curl -sS -D - -o /dev/null \
  -H "Authorization: Bearer <token>" \
  -X PATCH "https://gate-api-0dl0.onrender.com/v1/events/<eventId>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Runbook proof"}'
```

Copy the `X-Request-Id` value from the response headers.

2. In the Render dashboard for **`gate-worker`** (`srv-dahasmek1f9s73ebcjvg`), search logs for that same UUID (field `correlationId` on `Event cache invalidated` or `Worker job failed` lines).

3. Optionally search **`gate-api`** logs for the same id (field `requestId` on the HTTP access log).

If the ids match, request-to-job correlation is working.

## Symptom guide

| Symptom | Inspect | Safe first action |
| --- | --- | --- |
| Claims return errors | API errors, DB pool, lock wait, inventory invariant | Stop unsafe writes only if correctness is uncertain; do not switch authority to Redis |
| Reservations remain pending | `worker.heartbeatAt`, queue depth, `reservations.overduePending` | Restart `gate-worker`, then confirm sweep catches up |
| Public browse is stale | Cache invalidation queue failures, `event-cache-queue` depth | Invalidate affected public cache key; retain DB fallback |
| Door sync retries/duplicates | Device ID, batch ID, client scan IDs | Replay the same batch; never delete dedupe records to force success |
| Redis unavailable | `/health/ready`, API/worker logs | Preserve DB-backed correctness; restore Redis and observe catch-up |

## Inventory checks

- Compare event capacity with reserved and sold counters.
- Compare active reservations with the recorded reserved count.
- Find pending reservations older than their `expiresAt` — also surfaced as `reservations.overduePending` in `/health/metrics`.
- Never edit counters without a reviewed reconciliation procedure and an audit record.

## Restart order

1. Confirm PostgreSQL (`gate-db`) is healthy in Render.
2. Restore Redis (`gate-queue`).
3. Restart **`gate-api`** (`srv-dahascp5efls738oe8p0`) and verify:

```bash
curl -sS https://gate-api-0dl0.onrender.com/health/ready
curl -sS https://gate-api-0dl0.onrender.com/health/metrics | jq '.worker,.queues,.reservations'
```

4. Restart **`gate-worker`** (`srv-dahasmek1f9s73ebcjvg`) and confirm logs show `Worker process started` plus a fresh `worker.heartbeatAt`.
5. Observe queue catch-up and falling `reservations.overduePending`.
6. Run one public browse, claim, and check-in smoke test against https://gate-web-vxp3.onrender.com.

## Escalation and closeout

Escalate immediately if capacity may have been exceeded, a ticket may have been admitted twice, or offline reconciliation loses scans. After recovery, record symptom, measurements, root cause, what the evidence contradicted, correction, and prevention. Create the required team post-mortem only for an actual incident.
