# Render deployment

Gate deploys as two Node.js processes backed by managed PostgreSQL and Render Key Value:

The React/Vite frontend deploys separately as the `gate-web` Static Site from
`frontend/`, using Node 24 and publishing `dist`. The frontend and direct registration
are now on main. Browser routes are rewritten to `index.html`.

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

1. Merge #37 (frontend integration) and #38 (event-cache refactor). #11 (CI) is on
   `main`. Confirm every required check is green before applying this Blueprint.
2. In Render, create a new Blueprint from this repository and review the paid resource estimates before applying it.
3. Enter `CLOUD_NAME`, `API_KEY`, and `API_SECRET` when Render prompts. Do not put their values in Git.
   Set `gate-web`'s `VITE_API_URL` to the API's actual public HTTPS URL plus `/v1`.
   This is a build-time value; rebuild the frontend when it changes. Never use the
   API's private hostname in browser configuration.
   Add matching RSA PEM secret files named `private-key.pem` and `public-key.pem`
   to `gate-api` in Render. Production reads them from `/etc/secrets`; retain the
   same pair across releases. Missing files deliberately prevent startup.
   Separately, supply `PRIVATE_CHECKIN_KEY` and `PUBLIC_CHECKIN_KEY` as base64-encoded
   Ed25519 PEM keys for the signing helper in #28. Generate this pair once using
   that PR's `yarn setup:ticket-keys`, keep it outside Git, and retain it across
   deployments. The worker references the API's values so recovery jobs can issue
   the same signed tickets. These are not the RSA login-token keys above.
4. Confirm all four resources are in Frankfurt. Render connections then use internal URLs.
5. Leave PR previews disabled; duplicating PostgreSQL, Key Value, API, and worker resources per PR is unnecessary for this capstone.

Render generates `COOKIE_SECRET` and injects the database and queue connection strings.
The obsolete device secret has been renamed; on an existing deployment set the new
variable explicitly before deploying. The API alone runs `yarn db:migrate` before
a release, preventing the API and worker from racing the same migration.

## Current release blockers

- The event, reservation, payment-recovery, ticket-signing and door stacks through #36
  are merged, and #11 (CI) is on `main`. #37 still needs its frontend integration
  build and token-refresh handling resolved; #38 remains stacked behind it.
- #23 is rebased onto `main` and must pass the CI gate before deployment.
- Exercise the real browser journey: register, reserve, pay, show signed QR, check in,
  synchronize, and verify expiry/recovery. Mock/preview mode is not deployment evidence.

## Acceptance checks

1. The API deployment passes `GET /health/live` and `GET /health/ready`.
2. The worker log contains `Worker process started` with the expected worker count.
   The currently registered worker is cache invalidation, not reservation expiry.
3. A registration and login request succeeds without a server error.
4. One queued expiry job is processed once and its database result is visible.
5. API logs for the request include a request ID and do not include credentials.
6. Restart the worker and confirm it drains on `SIGTERM` without losing the queued job.
7. Confirm published event edits invalidate cached descriptors while availability
   is read live. Browse must not show sample data when the API fails.

## Deployment and rollback

API and worker automatic deployment is disabled so releases can be ordered.
Wait for GitHub CI to pass, stop the worker when a migration changes its schema,
then deploy the API at the intended commit. Its pre-deploy step runs migrations.
After API readiness succeeds, deploy/resume the worker at the same commit. A
pre-deploy command on the API alone does not order an independently deploying worker.
For a breaking migration, also stop API traffic during the migration using a
maintenance window; do not assume a rolling deploy is safe. If readiness fails,
inspect the migration outcome before restarting old code.
Deploy the static frontend manually after the API and worker are ready at the
same release. All three use manual deployments during integration.

For an application rollback, select the previous successful deploy for both `gate-api` and `gate-worker`. Do not reverse a database migration automatically. If a migration is not backward-safe, stop and use its reviewed recovery procedure.

## Logs and metrics

Use the Render dashboard for each service:

- API: request/error logs, deploy status, CPU, memory, instance count, and readiness failures.
- Worker: startup/shutdown logs, job failures, CPU, and memory.
- PostgreSQL: active connections, storage, CPU, memory, and slow-query investigation.
- Key Value: connections and memory. Treat rejected writes under `noeviction` as an urgent capacity signal.

Record the deployed commit SHA, failing request ID or job ID, resource name, and timestamp when escalating an incident.
