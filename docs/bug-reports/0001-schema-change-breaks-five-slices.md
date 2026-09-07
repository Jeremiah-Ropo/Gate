# Bug report — schema change in #3 leaves four slices uncompilable

**Raised by:** Victor Emeke (Events and console)
**Against:** Inventory — `f23806f` _chore(schema): add ticket reservation and event inventory tables (#3)_
**Date:** 2026-09-04
**Severity:** main does not compile

## Summary

PR #3 landed on `main` and changed columns belonging to four slices besides Inventory, without the
code in those slices being updated to match. `yarn tsc` reports **24 errors across five slices**.

This is not a challenge to the design. Moving capacity and the counters into `events_inventory` is
the agreed model, and the other changes look defensible on their merits — see _Assessment_ below.
The problem is that the code was left behind, and the owners of those slices do not know yet.

## Reproduction

```bash
git checkout main && git pull
yarn tsc
```

## What each owner needs to fix

| Slice    | Errors | What to change                                                                                                           |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Events   | 10     | Read `starts_at` instead of `start_date`; drop `end_date` / `timezone`; take capacity from `events_inventory`            |
| User     | 4      | `password` → `passwordHash`; remove `profilePicture` handling                                                            |
| Check-in | 4      | Ticket no longer has `checked_in` status, `owner_name` or `owner_email`; scan path must move from `code` to `qr_payload` |
| Auth     | 3      | `password` → `passwordHash`; remove `phoneNumber` from registration                                                      |
| Ticket   | 3      | Capacity now lives in `events_inventory`; tickets no longer carry `owner_name` / `owner_email`                           |

Events is being adapted by its owner. The other four need their owners.

## Assessment

Most of this reads as a genuine improvement rather than an accident:

- `end_date` and `timezone` are unused across the whole capstone journey, and `starts_at` is a
  `timestamptz`, so the absolute instant is already stored correctly without a zone column.
- Removing `checked_in` from `ticket_status` removes duplicated state: `check_ins` already records
  every scan with its own status, and two places holding attendance can disagree.
- `qr_payload` describes what the column actually holds better than `code` did.

Check-in is the slice with real work to do here, not just renames: its offline flow currently scans
a ticket `code` and writes `checked_in`, and neither exists now.

## Requests

1. Owners of Auth, User, Ticket and Check-in: adapt your slices, or say if you want the schema
   change reverted while you do.
2. Inventory: confirm how an event's inventory row gets created at publication. The schema comment
   says it must happen in the same transaction as the event, but there is no method for Events to
   call, and Events should not insert into `events_inventory` directly.
3. Going forward, changes reaching this many slices go through API contract review before merge —
   Check-in chairs that.

## Process note

`yarn lint` runs `tsc`, so a green pipeline should have blocked this merge. Worth checking whether
CI runs on pull requests, since all 24 errors reproduce from a clean checkout.
