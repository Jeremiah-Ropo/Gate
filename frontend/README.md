# Gate frontend integration

Use Node 24. Run `yarn install --frozen-lockfile`, `yarn lint`, `yarn test`,
and `yarn build` inside frontend. Set VITE_API_URL to the API's public URL plus /v1.

## Real API journey

- Anonymous browse uses GET /events and /events/:id: published projections with
  live inventory, price, currency, address and cover image. No sample-data fallback.
- Register/login returns the existing Platform session. No fabricated preview roles.
- Reserve uses POST /reservations with a retry-stable idempotency key.
- Payment uses POST /reservations/:id/pay. This capstone UI offers only the fake
  provider's success, declined and slow scenarios; it never collects real cards.
- Reservation ID stays in the URL so a reload can resume status polling. Processing
  is not success. Cancellation uses DELETE on the reservation.
- My tickets renders the issued payload locally. A legacy UUID is explicitly
  labelled not ready for scanning. Payload shape is not signature verification;
  the scanner must verify the signature and ID check.
- Organisers list their own events through /console/events and create events
  through the transactional /event/publish endpoint. Capacity is read-only on edit.
- Device registration was removed. The staff page only inspects ticket/scan records;
  it does not admit attendees or implement the offline scanner.

## Team handoff

Ayo owns signed issuance and the holder-name request/persistence contract, expiry
and payment-recovery handlers. This PR deliberately does not edit those services.
The current create-reservation DTO accepts only eventId; update this client when
the attendee-name contract lands, rather than sending a field the server ignores.
Timi owns offline signature verification, ID checks and event-scoped scanning/sync.
The existing bearer-session storage remains in localStorage; this PR does not
claim to migrate authentication to HTTP-only cookies.

## Verification

Frontend tests cover API paths, projection mapping, idempotency headers and
processing-state handling. From the repository root, with a disposable local
database and API running:

```sh
DATABASE_URL=postgresql://postgres@127.0.0.1:55439/gate_review node scripts/smoke-frontend-api.mjs
```

The smoke script creates QA records and tests register, publish, anonymous browse,
reserve, pay, tickets, cancel and live availability. It does not prove offline
admission, restart recovery, worker execution or deployment.
