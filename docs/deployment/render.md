# Render deployment

Gate deploys as two Node.js processes backed by managed PostgreSQL and Render Key Value:

```text
browser/client -> gate-api -> gate-db
                         \-> gate-queue -> gate-worker -> gate-db
```

`render.yaml` is the source of truth. It creates:

- `gate-api`, the public Express web service;
- `gate-worker`, the private BullMQ consumer;
- `gate-db`, the PostgreSQL authority for durable state; and
- `gate-queue`, an internal-only Redis-compatible queue using `noeviction` so queue keys are not discarded.

## Before the first deployment

1. Merge the stack through the CI quality-gate PR and confirm its required check is green.
2. In Render, create a new Blueprint from this repository and review the paid resource estimates before applying it.
3. Enter `CLOUD_NAME`, `API_KEY`, and `API_SECRET` when Render prompts. Do not put their values in Git.
4. Confirm all four resources are in Frankfurt. Render connections then use internal URLs.
5. Leave PR previews disabled; duplicating PostgreSQL, Key Value, API, and worker resources per PR is unnecessary for this capstone.

Render generates `DEVICE_JWT_SECRET` and injects the database and queue connection strings. The API alone runs `yarn db:migrate` before a release, preventing the API and worker from racing the same migration.

## Acceptance checks

1. The API deployment passes `GET /health/live` and `GET /health/ready`.
2. The worker log contains `Worker process started` with the expected worker count.
3. A registration and login request succeeds without a server error.
4. One queued expiry job is processed once and its database result is visible.
5. API logs for the request include a request ID and do not include credentials.
6. Restart the worker and confirm it drains on `SIGTERM` without losing the queued job.

## Deployment and rollback

Production deploys wait for GitHub checks because both services use `autoDeployTrigger: checksPass`. The API migration runs before traffic moves. If the API fails readiness, Render retains the previous healthy deployment.

For an application rollback, select the previous successful deploy for both `gate-api` and `gate-worker`. Do not reverse a database migration automatically. If a migration is not backward-safe, stop and use its reviewed recovery procedure.

## Logs and metrics

Use the Render dashboard for each service:

- API: request/error logs, deploy status, CPU, memory, instance count, and readiness failures.
- Worker: startup/shutdown logs, job failures, CPU, and memory.
- PostgreSQL: active connections, storage, CPU, memory, and slow-query investigation.
- Key Value: connections and memory. Treat rejected writes under `noeviction` as an urgent capacity signal.

Record the deployed commit SHA, failing request ID or job ID, resource name, and timestamp when escalating an incident.
