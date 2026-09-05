# Check-in slice design

- Status: Proposed for team review
- Owner: Timilehin
- Reviewer: Assigned outside Check-in before merge
- Related: ADR 0006 (offline journal), ADR 0007 (offline conflict detection)

## Problem and ownership

Check-in owns everything that decides whether a person walks through the door: the verification rule, the offline journal, the batch reconciliation endpoint, and the door surface. It must prove that a ticket cannot be forged, that a ticket cannot be admitted twice through any path the system controls, and that a scan recorded while offline is never lost and never counted twice.

## Design

**Authenticity is proved by a signature, not by a lookup.** At issuance the server signs `<ticketId>.<eventId>` with an Ed25519 private key it alone holds. The signed string `<ticketId>.<eventId>.<signature>` is stored in `tickets.qr_payload` and rendered as the QR. A door holds only the matching public key, which can confirm a ticket is genuine but cannot produce one. A shared secret was rejected for the same reason: door devices belong to volunteers, and anything able to verify would also be able to forge.

Because authenticity is self-contained in the code, the door needs no ticket list. On **start check-in** it fetches a manifest containing the public key and only the two sets of *exceptions*: tickets already admitted (`check_ins` where `status = 'success'`), and tickets that are no longer honourable (`tickets` where `status != 'valid'`). Any other correctly signed ticket for this event is good. The manifest is therefore bounded by exceptions rather than by attendance, and holds nothing that could forge a ticket.

**A door device is a person, not a registry entry.** Door staff are users linked to an event through `event_members` with `status = 'active'`. An organizer adds them directly and the membership is usable immediately; access is withdrawn by setting `revoked`. This replaces the `check_in_devices` registry, which required storing a long-lived secret on a volunteer's phone and made registration, revocation and key rotation standing operational work for no additional guarantee.

There is no invite to accept. The property that matters is that only authorized people can verify tickets at this event, and direct assignment satisfies it; an invite would add a state machine, a single-use token, and an email pipeline to collect a consent an organizer would not honour a refusal of. Working a door is a shift assignment. The consequence, stated rather than hidden: nobody is notified when they are put on a door, and staff discover it from their event list.

**One verification path, online or offline.** Every scan runs the same four checks on the device, in order: signature valid against the public key, `eventId` matches this event, `ticketId` not in the blocked set, `ticketId` not in the seen set. The first two failures are `invalid`, the third `denied`, the fourth `duplicate`. All four passing is `success`. Connectivity changes only when the pending queue drains, never how a scan is judged, so the offline path cannot silently diverge from the online one.

Before the checks run, the device generates a `clientScanId` for the scan. Afterwards it adds the ticket to its local seen set if the scan succeeded, and appends `{ clientScanId, scannedCode, scannedAt, result }` to a durable pending queue. Rejected scans are queued too, so the server receives a complete audit log rather than a record of admissions only.

**Reconciliation is idempotent and server-authoritative.** The device flushes its queue after each scan, on regaining connectivity, and on a 30–60s interval. Per scan the server skips any `clientScanId` it has already recorded and replays the stored outcome, re-verifies the signature itself, re-reads `tickets.status`, and inserts a `check_ins` row. A partial unique index on `check_ins (ticket_id) WHERE status = 'success'` makes a second admission fail at the database rather than in application logic; the rejection is recorded as a conflict. The response returns a per-scan result plus the event's full set of admitted ticket IDs, which the device adopts as its new seen set — this is how a phone at one door learns about scans made at another.

Two doors that are simultaneously offline can both admit the same ticket. That is surfaced on sync, not prevented. See ADR 0007 for the argument and the bound on the exposure.

## Interface

Express routes under `/v1`, mounted from `src/core/Routers.ts`. All door routes require `AuthGuardMiddleware.authenticate` plus a new `requireEventMember` guard.

- `GET /v1/check-in/events/:eventId/session` returns `{ eventId, publicKey, checkedInTicketIds, blockedTicketIds }`.
- `POST /v1/check-in/events/:eventId/scans` takes an array of pending scans, each carrying its own `clientScanId`; returns `{ results: [{ clientScanId, status }], allCheckedInIds }`.
- `GET /v1/check-in/events/:eventId/stats` and `/scans` give the organizer a live count and the scan log, including conflicts.
- `POST /v1/event-members/events/:eventId` adds a member, `DELETE /v1/event-members/events/:eventId/users/:userId` revokes one, `GET /v1/event-members/events/:eventId` lists them, and `GET /v1/event-members/my-events` is the staff member's own view.
- `signTicket(ticketId, eventId)` and `verifyTicket(payload)` live in `src/core/global/utils/ticket-signature.ts`. The Ticket slice's only touchpoint is setting `qrPayload: signTicket(id, eventId)` at issuance, with the ticket `id` generated in application code before insert so it can be signed.

## Data model

`check_ins` is a scan log: every scan gets a row, with `ticket_id` nullable so an unparseable code is still auditable, `event_id`, `scanned_by`, `scanned_code`, `status`, `scanned_at`, `synced_at`, and a unique `client_scan_id`. Indexed on `(event_id, status)` for the manifest query, with the partial unique index above for one-admission-per-ticket.

`event_members` links a user to an event with a role and a status (`active` | `revoked`), unique on `(event_id, user_id)`. Revoked rather than deleted, so the scan log keeps a member to point at and the event keeps a record of everyone who was ever able to work its door.

Check-in state is deliberately not a column on `tickets`. `tickets.status` says what a ticket *is*; `check_ins` says what was *done* with it, and both can be true at once — a ticket may be refunded after having been scanned. "Is ticket X admitted?" is `exists check_ins where ticket_id = X and status = 'success'`. Keeping the fact here also means this slice writes no columns on a table another slice owns.

## Failure and test plan

- A tampered `ticketId`, `eventId`, or signature is rejected offline, with no server round trip.
- A ticket signed for a different event is `invalid` at this event's door.
- Replaying an identical batch returns identical results and creates no additional rows.
- Killing the door page before or after send loses no recorded scan.
- A partial or lost response leaves unacknowledged scans pending and is safely resent.
- A second scan of one ticket at a single door is `duplicate` while offline, from the seen set alone.
- Two offline doors admitting one ticket produce exactly one `success` row and one visible conflict.
- A staff member with no membership, or a revoked one, cannot open a session for the event, and cannot tell which of the two they are.
- Revocation takes effect on the next manifest fetch; an already-open offline session is bounded by the event, which is stated rather than hidden.

## Deliberate cuts and open questions

No device registry, no invite/accept flow, no per-door ticket partitions, no seat assignment, no re-entry or exit scanning, and no attempt to reverse an admission that already physically happened. Nobody is notified when they are added to a door. Check-in alert emails are deferred: `tickets` no longer carries owner name or email after the reservation schema change.

Members must be existing accounts: `event_members.user_id` is `NOT NULL` and the table carries no email of its own. If door staff are expected to be volunteers who have not signed up, that needs an email column and a link-on-signup path, and is cheaper to add before this schema merges than after.

The door surface is a phone browser PWA with an IndexedDB journal, per ADR 0001 and ADR 0006. It is **out of scope for the current PRs** because ADR 0001's React/Vite choice is still unconfirmed and this repository has no frontend. The backend contract above is built and testable without it.

Open: clock-skew treatment for `scanned_at`, scan-log retention beyond the event, manifest refresh interval, and whether `event_members` should also govern organizer routes now that event-level membership exists.

## AI disclosure

AI helped structure this draft and reconcile it against the existing Express codebase. The owner must verify the offline threat model, the signature scheme, the conflict bound argued in ADR 0007, and the kill/retry tests before acceptance.
