# Bug report — `null` provider status fails an in-flight payment

**Raised by:** Ibukun (Platform)
**Against:** Inventory / ticket reservations — Awe Ayomidipupo
**Found on:** [PR #31](https://github.com/Jeremiah-Ropo/Gate/pull/31)
**Date:** 2026-09-10
**Severity:** a successful charge can exist with no ticket, and the reserved unit can be released while the provider is still accepting the card

## Summary

`recoverOneStalePayment` and `reconcilePayment` both treat `paymentProvider.getStatus(reference) === null` as a definitive failure. They restore the reservation to `pending` and leave inventory reserved for a retry.

`null` is not "the provider declined this card." It is "this reference is not in `stub_payment_requests` yet." That row is written **after** the reservation has already been moved to `payment_processing`.

This was raised on #31 before merge. The reply was that a long enough stale TTL makes absence safe, because a crash before the provider call leaves no provider record. That argument covers the sweep. It does not cover a read that happens while `pay()` is still running.

## Reproduction

The window is the gap between these two commits:

1. `startPayment` commits: reservation is `payment_processing`, a local payment attempt exists, inventory is still reserved.
2. `PaymentProvider.pay()` inserts `stub_payment_requests`.

Any status lookup in that window returns `null`.

```text
Client A: POST /reservations/:id/pay
  -> startPayment commits
  -> pay() has not inserted the stub row yet

Client B (or the same client polling): GET /reservations/:id
  -> getById sees payment_processing
  -> reconcilePayment()
  -> getStatus() === null
  -> restoreAfterPaymentFailure()  // reservation back to pending

Client A: pay() then inserts succeeded
  -> handlePaymentResult tries to mark paid
  -> reservation is no longer payment_processing for this attempt
```

The same `null => failed` branch lives on the recovery worker:

```ts
if (status === null) {
  await this.restoreAfterPaymentFailure(...)
  return "failed";
}
```

`test/payment-recovery.test.ts` covers "missing provider payment as failed" with a fixture that never creates a stub row. It does not cover "missing **because the insert has not happened yet**."

## What breaks

| Path                                    | Why `null` is wrong                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET` during an in-flight pay           | `getById` reconciles immediately. TTL does not apply. A poll can fail a payment that is about to succeed.                                                        |
| Recovery after a 30s hang               | Default processing TTL is 60s and the hang card takes 30s. Shorten TTL, or delay the insert, and the sweep fails a charge the stub later records as `succeeded`. |
| Process kill after start, before insert | Awe's stated case. Safe only if nobody later writes that reference as succeeded. The live `pay()` call still can.                                                |

The capstone count is not the only casualty. The worse outcome is a provider success with no ticket: inventory is released, someone else can claim the last seat, and the original payer has a charge and nothing to scan.

## Assessment

ADR 0009 already rejected "mark every provider error as failed" because an unknown outcome can be a successful charge. Treating `null` as failed is the same decision with a different name.

The durable stub table is the right recovery source. The mistake is using "row not found" as a terminal state instead of "not ready to decide."

## Requests

1. Keep `null` as `processing` on both the worker and `reconcilePayment`. Retry after the lease / next poll.
2. Fail only on an explicit provider `failed`, or on a documented deadline that starts after the provider row exists.
3. Add the overlap test asked for on #31: start payment, look up status before the stub insert, assert the reservation stays `payment_processing` and no inventory is released.
4. Keep the existing "no stub row after a real crash" case, but decide it with time-since-attempt plus "provider never created," not with a single `null`.

## Process note

This is the slice I was handed to break because the review already named the hole and merge did not close it. The approving review on #31 did not require the overlap test. Victor's #0001 is a different Inventory incident (schema compile break). This one is about money and the count after the schema had already landed.
