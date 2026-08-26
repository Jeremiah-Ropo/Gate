# Gate

Event ticketing and offline door check-in backend.

Structure follows a layered module pattern (`entity → repository → service → controller → routes`)
per domain module under `src/Modules`, with shared infrastructure under `src/core`.

PostgreSQL is the source of truth, accessed through Drizzle ORM (`src/core/db/postgres`). Redis backs
BullMQ queues, idempotency locks, and the offline check-in dedupe window.

## Modules

- **Auth** — register/login/refresh, RS256-signed JWTs
- **User** — attendee/staff/admin accounts
- **Event** — events an organizer publishes, with capacity and pricing
- **Ticket** — issued tickets tied to a user + event, each with a scannable code
- **CheckIn** — registered door-scanning devices and the check-in records they submit, including
  batched offline sync with idempotent dedupe via `clientScanId`

## Getting started

```bash
cp .env.example .env
yarn install
yarn setup:dev        # generates the RS256 keypair used to sign JWTs
docker compose up -d postgres redis
yarn db:generate       # generate SQL migrations from the schema
yarn db:migrate        # apply them
yarn dev
```

## ⚠️ This is a template not from the main system architectural design.
## Offline check-in flow

1. A door device registers against `POST /v1/check-in/devices` (admin-only) and is issued a device
   key + secret.
2. The device authenticates via `POST /v1/check-in/devices/auth` to receive a short-lived device
   token, then pulls the event's valid ticket codes for local caching.
3. While offline, the device records scans locally, each tagged with a client-generated
   `clientScanId`.
4. On reconnect, it submits the batch to `POST /v1/check-in/sync`. The server dedupes on
   `clientScanId`, validates each ticket, and returns a per-scan result.
