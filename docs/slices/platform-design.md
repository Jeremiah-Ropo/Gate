# Platform slice design

- Status: Proposed for team review
- Owner: Ibukun
- Reviewer: Assigned outside Platform before merge

## Problem and ownership

Platform owns accounts and roles, rate limiting, queue/workers, deployment, logs, and metrics. It provides shared runtime contracts without owning ticket-count correctness, event-read behavior, public browse, or offline reconciliation business rules.

## Current baseline

The repository uses Express/TypeScript, Drizzle/PostgreSQL, Redis/ioredis, BullMQ, JWT, `express-rate-limit`, and Pino. Roles are `attendee`, `staff`, and `admin`. Today the limiter is process-local, workers start inside the API, the only worker sends forbidden-scope notifications, and the root health endpoint does not report dependency readiness.

## Design

Build one application codebase with separate API and worker entrypoints. PostgreSQL is durable state; Redis provides distributed rate-limit state, cache connectivity, and BullMQ delivery. The API authenticates once, applies route-specific role and limit policies, commits domain work, and then publishes jobs. Workers receive stable entity IDs and correlation metadata, call owner-provided idempotent domain functions, and emit structured outcomes.

Use delayed reservation-expiry jobs plus a periodic overdue-reservation sweep. The sweep is recovery for a missed enqueue or queue outage; it does not transfer Inventory ownership to Platform. Run cache invalidation as background work after committed event changes.

## Access and traffic policy

Anonymous users browse only published events. Attendees claim and view their tickets. Staff operate approved door/device flows. Admins manage events/devices. Start with configurable policies: login 10/minute/IP and account key; claims 5/minute/user plus IP protection; admin mutation 60/minute/user; public reads 120/minute/IP; door sync 300/minute/device or staff. Return `429` with retry information.

## Operability and test plan

- API and worker start, stop, and report health independently.
- Migrations run once per release and shutdown drains safely.
- Logs contain request/job correlation ID, safe actor/entity IDs, outcome, duration, and stable error code; secrets are redacted.
- Metrics cover HTTP latency/errors, `401`/`403`/`429`, queue age/depth, retry/failure, worker heartbeat, and overdue reservations.
- Tests cover role decisions, shared Redis limits, duplicate jobs, queue outage plus sweep recovery, dependency readiness, and correlation propagation.

## Deliberate cuts and open questions

No notifications, chart dashboard, general permission engine, or Kubernetes. Confirm Redis failure policy, deployment provider/secrets, event-scoped roles, and final limit values from load evidence.

## AI disclosure

AI helped inspect the repository and structure this draft. Ibukun must manually verify and defend the boundaries, failure policies, limits, and operational evidence.
