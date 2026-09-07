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

## Events & console slice

Design: [docs/events-and-console-design.md](docs/events-and-console-design.md) · Caching rationale:
[ADR 0004](docs/adr/0004-events-read-model-caching.md)

Owns event creation/publication, the published-event read model, and the read-only organiser
console. **This slice serves no anonymous HTTP** — the Public browse slice owns those endpoints and
consumes the projection exported from `src/Modules/Event/index.ts`:

```ts
import { eventProjectionService, IPublishedEventProjection } from "Modules/Event";
```

| Method | Path                 | Auth        | Notes                                               |
| ------ | -------------------- | ----------- | --------------------------------------------------- |
| POST   | `/v1/events/publish` | staff/admin | Creates event + inventory row in one transaction    |
| POST   | `/v1/events`         | staff/admin | Creates a draft                                     |
| PUT    | `/v1/events/:id`     | staff/admin | `capacity` is not accepted — it is fixed at publish |
| GET    | `/v1/console`        | none        | Read-only console page (shell only, holds no data)  |
| GET    | `/v1/console/events` | staff/admin | The organiser's own events, drafts included         |

Event fields come from `events`. `capacity`, `reserved`, `sold` and the generated `remaining` come
from Inventory's `events_inventory` row and are read live on every request. When Inventory cannot be
read they project as **`null`, meaning unknown — not `0`, which would read as sold out**.

Publication is the one place this slice writes `events_inventory`: the row is created in the same
transaction as the event, because Inventory's schema requires it to exist from the start.

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
