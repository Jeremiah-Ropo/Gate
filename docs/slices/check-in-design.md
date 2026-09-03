# Check-in slice design

- Status: Proposed for team review
- Owner: Timilehin
- Reviewer: Assigned outside Check-in before merge

## Problem and ownership

Check-in owns the idempotent online endpoint, offline batch reconciliation, phone door page, and API contract across the system. It chairs contract review and must prove that one ticket cannot admit two people even when devices are offline, retry, or die mid-write.

## Design

An approved staff member registers a door device for an event. The phone browser/PWA downloads the event's signed/verifiable ticket data and its door authority while online. Only public verification material is stored on the device; server signing secrets never leave the backend.

Offline scans are appended to IndexedDB before the UI reports them as recorded. Each scan has a stable client-generated `clientScanId`, device ID, event ID, ticket code, door partition/authority, and client timestamp. The UI gives a local decision only within the device's assigned authority and retains pending scans until acknowledged.

On reconnect, the device sends a bounded batch. PostgreSQL records each client scan ID uniquely, validates ticket/event/partition/status, performs an idempotent check-in transition, and returns a result per scan. Replaying a batch returns the previous result. Multiple doors must use non-overlapping ticket/door partitions or another reviewed conflict rule; connectivity cannot retroactively undo a physical admission.

## Interface

- Register/authenticate device with revocable credentials.
- Download versioned offline verification dataset and partition.
- Submit batch with batch ID and stable scan IDs.
- Return `success`, `duplicate`, `invalid`, or `denied` per scan plus server timestamp.

## Failure and test plan

- Duplicate online request admits once.
- Replaying an offline batch yields the same results.
- Killing the PWA before/after send does not lose a recorded scan.
- Two doors cannot both validly admit the same partitioned ticket offline.
- Slow server and partial batch failure preserve pending local records.
- Revoked device/key rotation behavior is documented and tested.

## Deliberate cuts and open questions

No native app, Bluetooth coordination, cosmetic work, or server secret on the device. Confirm partition strategy, dataset size, credential rotation/revocation, clock-skew treatment, and reconciliation retention.

## AI disclosure

AI helped structure this review draft. The owner must verify the offline threat model, device lifecycle, partition strategy, and kill/retry tests before acceptance.
