# ADR 0007: Detect double admission across offline doors rather than prevent it

- Status: Proposed
- Owner: Timilehin, Check-in
- Date: 5 September 2026
- Supersedes: the door-partitioning clause of ADR 0006

## Context

Gate sells general admission. Nothing on a ticket names a door, and an attendee is expected to join whichever queue is shortest. Doors are phone browsers that must keep admitting people through a network outage, and two disconnected doors cannot exchange state.

ADR 0006 closed that gap by allocating non-overlapping ticket/door partitions so two offline doors could never both authorize the same ticket. Building the slice against that decision showed the rule cannot be satisfied without changing the product. Enforcing a partition at the door requires the attendee to be routed to the door that owns their ticket, and general admission provides no basis for routing them. A door that refuses a genuine, correctly signed ticket because it belongs to another partition produces a worse and more frequent failure than the one the partition prevents.

A ticket cannot be forged in either design: the payload is signed by a key the door does not hold. The question is only whether one genuine ticket can admit two people.

That exposure is not limited to an outage, and an earlier draft of this ADR was wrong to say it was. The door decides locally and admits immediately rather than waiting for the server, so the window runs from the moment one door admits a ticket to the moment every other door has learned of it. Two doors that are fully online can therefore both admit the same ticket: the first admits at 19:00:00 and queues the scan, the second scans at 19:00:02 against a seen set it last refreshed at 18:59:30, and neither has done anything wrong. Connectivity does not create the window, it only changes its length — bounded by the sync interval when online, unbounded when a door is offline.

## Decision

Every door may admit any ticket for its event. The device decides locally from the four checks — signature, event match, blocked list, seen list — and connectivity changes only when the pending queue drains, never how a scan is judged.

Double admission is not prevented at the door, whether the doors are offline or merely un-synced. It is detected on sync and surfaced. The database is the authority, not application logic: a partial unique index on `check_ins (ticket_id) WHERE status = 'success'` rejects a second successful check-in, and the rejected scan is recorded as a conflict carrying both timestamps and both scanning staff members. Organizer read-back of conflicts is a required deliverable of this slice, not an optional extra; a conflict nobody can see is not detected.

Rejected scans are persisted, so the scan log is a complete audit record rather than a record of admissions only.

ADR 0006 stands in every other respect. Its journal, its stable client scan IDs, its idempotent batch reconciliation, and its rule that no signing secret reaches the device are unchanged.

## Alternatives rejected

- Non-overlapping ticket/door partitions, as ADR 0006 specified: upholds the invariant, but general admission gives no rule for assigning an attendee to a door, so it either breaks any-door access or degrades into manual routing at the entrance.
- One authoritative door, others degrade to "needs confirmation" when offline: preserves the invariant automatically, but multiplies door UI states and concentrates the outage risk on a single device.
- Require connectivity at the door: violates the core requirement, and was already rejected in ADR 0006.
- Shorten the sync interval: narrows the online window without closing it, and does nothing during an outage. Worth tuning, not a mitigation.
- Wait for the server before admitting: closes the online window and is the only thing that would, but it makes every admission depend on connectivity, which the brief rules out. A door that stalls on a dropped packet is a queue on the pavement.

## Consequences

The system guarantees at most one *recorded* successful check-in per ticket, and a visible, attributable conflict for any second attempt. It does not guarantee at most one *physical* admission per ticket, online or offline. That distinction must be stated plainly to the organizer rather than implied by the interface.

A door must never discard a local admission it has recorded. On sync the device merges the server's admitted set with its own, rather than replacing it: a local success the server has not yet acknowledged is still an admission, and forgetting it would let the same ticket go green again — a double admission caused by the sync itself. A success is written to durable storage before the screen shows it, and survives the app being killed.

Conflict resolution becomes a staffing concern rather than a system behaviour: the second person is already inside, and no reconciliation can retroactively undo a physical admission. Scan-log retention must cover the whole event, and the organizer surface must expose conflicts prominently enough to be acted on during the event, not after it.

Because partitions are gone, the manifest no longer needs a per-door dataset. Every door receives the same exception lists, which removes partition assignment, partition drift, and partition-aware device provisioning from the operational surface.

## Proof

Test two offline doors admitting the same ticket and both reporting green locally; **two fully online doors doing the same inside one sync interval**; exactly one `success` row after both batches sync, with the second recorded as a conflict; the conflict visible through organizer read-back with both timestamps and both staff identities; replay of either batch changing nothing; a second scan of the same ticket at a single door still rejected locally by the seen set; **a local success surviving a sync response that does not mention it, and surviving the app being killed and reopened**; and a signed ticket for a different event rejected before any of this is reached.
