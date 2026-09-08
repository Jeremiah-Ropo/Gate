# Event ticket claim flow

This document describes how Gate turns event capacity into a reservation, then into a paid ticket. It focuses on the consistency boundary: PostgreSQL owns the inventory counters, and application code never treats a read as proof that a ticket is available.

## The state we protect

Each published event has one `events_inventory` row:

| Field       | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `capacity`  | Maximum tickets the event can sell.                                     |
| `reserved`  | Holds currently attached to pending or payment-processing reservations. |
| `sold`      | Paid tickets issued for the event.                                      |
| `remaining` | PostgreSQL-generated value: `capacity - reserved - sold`.               |

The database enforces the counter invariants:

- `reserved >= 0`
- `sold >= 0`
- `capacity >= 0`
- `reserved + sold <= capacity`
- `remaining = capacity - reserved - sold`

A reservation represents one held inventory unit. Its lifecycle is:

```text
pending ──pay──> payment_processing ──success──> paid
   │                       │
   │                       ├──provider failure/missing──> pending
   │                       └──recovery while processing──> payment_processing
   │
   ├──cancel──> cancelled
   └──expiry──> expired
```

`pending` and `payment_processing` still consume `reserved`. Only the successful payment transition moves one unit from `reserved` to `sold`. Cancellation and expiry release the unit without increasing `sold`.

## Event publication creates the inventory authority

An event may be created as a draft, but the publish path is the path that makes an event claimable. `EventService.publishEvent` runs in one PostgreSQL transaction:

1. Insert the event with `status = published`.
2. Insert its `events_inventory` row with the requested capacity.
3. Commit both rows together.

This prevents a published event from committing without the inventory row that every reservation claim requires. Ordinary event updates cannot set an event to `published`; publication must go through this transaction.

## Creating a reservation: conditional inventory claim

`POST /reservations` calls `TicketReservationService.create`. The service opens one transaction and:

1. Reads the event and requires it to exist and be `published`.
2. Atomically increments inventory with a conditional update equivalent to:

   ```sql
   UPDATE events_inventory
   SET reserved = reserved + 1
   WHERE event_id = $event_id
     AND remaining >= 1
   RETURNING *;
   ```

3. Inserts a `pending` reservation with an `expires_at` deadline.
4. Commits both changes together.

There is no application-side read-then-write decision and no explicit `SELECT FOR UPDATE` on the hot claim path. PostgreSQL still serializes competing updates to the same inventory row internally. If two requests race for the final unit, one update sees `remaining >= 1` and succeeds; the other waits for the row version and re-evaluates the predicate against the committed value, then receives no returned row. The losing transaction does not insert a reservation.

If the inventory update or reservation insert fails, the transaction rolls back. A failed reservation attempt therefore cannot leave a partially incremented `reserved` counter.

## Paying a reservation: hold first, settle later

The payment endpoint only accepts a reservation owned by the current user. It returns an existing paid reservation as an idempotent result, reconciles an already-processing reservation, and rejects cancelled or expired reservations.

### Entering payment processing

Before calling the provider, `startPayment` opens a transaction and conditionally changes:

```text
pending -> payment_processing
```

It records `latest_payment_id` and `payment_processing_expires_at`, then inserts a processing payment attempt. A partial unique index allows only one processing attempt per reservation. The provider call happens after this transaction commits, so a slow provider never holds the reservation or inventory database transaction open.

The inventory unit remains reserved while payment is processing. This prevents another customer from taking the unit while the outcome is being resolved.

The reservation creation route also uses Redis-backed idempotency middleware. That middleware reduces duplicate request work and returns cached successful responses, but it is not the inventory authority. The database conditional update and constraints remain the correctness boundary. Payment does not currently depend on idempotency-key middleware; its state transition and partial unique index provide the duplicate-attempt guard.

### Successful settlement

`claimPaidReservation` runs the local finalization in one transaction:

1. Change the payment attempt from `processing` to `succeeded`.
2. Change the reservation from `payment_processing` to `paid`, requiring the same payment attempt to remain its latest payment.
3. Atomically move one inventory unit from reserved to sold:

   ```sql
   UPDATE events_inventory
   SET reserved = reserved - 1,
       sold = sold + 1
   WHERE event_id = $event_id
     AND reserved >= 1
   RETURNING *;
   ```

4. Read the purchaser/owner name, sign the ticket payload, and insert the ticket. The ticket’s `reservation_id` is unique, so at most one ticket belongs to a reservation.

If any step fails, the transaction rolls back all local finalization changes. The provider may already have succeeded, but the local payment attempt remains recoverable and a later poll or recovery sweep can retry the same transition.

If another request already completed the transition, the conditional payment update returns no row. The service checks whether the reservation is already `paid` and returns the existing ticket instead of issuing another one.

### Failed, missing, or uncertain provider outcomes

- A provider failure changes the payment attempt to `failed` and the reservation back to `pending`. The reserved unit is deliberately kept so the user can retry until the reservation expires.
- A missing provider request returns `null` from the provider interface. Gate treats that as a failed payment because there is no provider record that the request reached the provider; the reservation returns to `pending` and the reserved unit remains available for retry.
- A provider response of `processing` leaves the reservation in `payment_processing`. The client receives a processing response and can poll.
- A timeout or provider conflict triggers status reconciliation. An unexpected provider status error is surfaced as a gateway error on the request path and remains eligible for background recovery.

## Cancellation and expiry

Cancellation is only valid for `pending` reservations. In one transaction it conditionally changes the reservation to `cancelled` and decrements `reserved` with `reserved >= 1` as a guard. If either transition fails, the transaction rolls back.

The reservation worker also runs a PostgreSQL expiry sweep for overdue `pending` reservations. Payment-processing reservations are not expired by this path; they are handled by payment recovery instead.

The expiry sweep is bounded by both rows and events:

1. A CTE selects at most `RESERVATION_EXPIRY_MAX_EVENTS` event IDs with overdue pending reservations.
2. A second CTE selects at most `RESERVATION_EXPIRY_BATCH_SIZE` reservations for those events and locks them with `FOR UPDATE SKIP LOCKED`.
3. One `UPDATE ... FROM ... RETURNING` changes the selected reservations to `expired`.
4. The service groups the returned rows by event and performs one conditional inventory release per event in the same transaction.

The explicit row lock is intentional here: it partitions sweep work between workers. It is not needed for the hot reservation claim because the conditional inventory update already provides the compare-and-set behavior.

## Payment recovery after a timeout or restart

The payment worker drains stale attempts one at a time until no eligible attempt remains. Each attempt is claimed by one CTE-backed statement:

1. The CTE selects one expired `payment_processing` attempt whose recovery lease is absent or expired, using `FOR UPDATE SKIP LOCKED`.
2. The `UPDATE ... FROM` writes a recovery claim ID and lease deadline and returns the reservation, user, and provider reference.
3. The database transaction commits before the provider is queried.
4. `succeeded` reuses the successful finalization transaction; `failed` and `null` reuse the failure transition; `processing` leaves the attempt untouched apart from its lease.

The lease prevents two workers from doing the same external lookup concurrently, while `SKIP LOCKED` lets other workers make progress on other attempts. If a worker dies after claiming a row, the lease eventually expires. If finalization races with a client poll or another worker, the conditional updates and unique ticket constraint make the result idempotent.

## Failure matrix

| Failure or race                           | Local result                                                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event is missing or not published         | No inventory mutation; return not-found/conflict.                                                                                                                                            |
| Two customers claim the final unit        | One reservation succeeds; the other gets sold out.                                                                                                                                           |
| Reservation expires before payment starts | Conditional `pending` update returns no row; no provider payment is started.                                                                                                                 |
| Provider declines payment                 | Attempt is `failed`; reservation is `pending`; inventory remains reserved.                                                                                                                   |
| Provider request is missing               | Same local result as a failed payment.                                                                                                                                                       |
| Provider times out                        | Reservation remains `payment_processing`; polling and recovery can reconcile it.                                                                                                             |
| Provider succeeds but the API/worker dies | Durable provider state plus the recovery sweep can complete the local transition.                                                                                                            |
| Provider status is still processing       | Recovery lease expires later; no inventory transition occurs.                                                                                                                                |
| Database failure during any transaction   | PostgreSQL rolls back the partial state change.                                                                                                                                              |
| Redis/BullMQ is unavailable               | Redis idempotency or cache-backed work may reject or delay a request, but it cannot corrupt inventory; periodic sweeps recover overdue reservations and stale payments after workers return. |

## What is and is not locked

The system does use PostgreSQL row locks internally whenever it updates a row, and the background sweeps explicitly use `FOR UPDATE SKIP LOCKED`. The important hot-path property is narrower: customer reservation claims do not first lock and read inventory in application code. They use one conditional database update, so correctness comes from PostgreSQL’s row-update serialization, MVCC predicate recheck, transactions, and constraints rather than an application-held mutex.

The application does not rely on the cached or projected `remaining` value as authority. The only successful claim, sale, release, or expiry is the conditional database mutation that returns the changed row.
