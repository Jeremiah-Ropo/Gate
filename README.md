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
- **CheckIn** — door staff verifying tickets at an event, and the scan log they produce,
  including batched offline sync with idempotent dedupe via `clientScanId`

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

1. An organizer adds a staff member to an event (`event_members`). A door device is not
   registered hardware; it is a logged-in user with an active membership for that event.
2. Staff sign in normally and open the event. Verification material is the event's public
   key plus the exception lists, so the device needs no ticket list.
3. While offline, the device records scans locally, each tagged with a client-generated
   `clientScanId`, persisted before the screen reports admission.
4. On reconnect it submits the batch to `POST /v1/check-in/events/:eventId/sync`. The server
   dedupes on `clientScanId`, revalidates each ticket, and returns a per-scan result. Every
   scan records who made it in `check_ins.scanned_by`.
