import type { QueuedScan } from "./scanQueue";
import type { TicketVerifier } from "./keys";
import { verifyTicket, type VerifiedTicket } from "./verifyTicket";

/**
 * One scan, start to finish: check the signature, judge it against the manifest, write it
 * down, and only then say what happened.
 *
 * Extracted from the page so the ordering can be tested. That ordering is the point of this
 * module -- ADR 0007 requires a success to reach durable storage *before* the screen reports
 * admission, because a person waved through on a scan the device never recorded is an
 * admission that no longer exists anywhere. Testing it inside a React component would need a
 * DOM and a component harness; here the dependencies are just arguments.
 */
export type ScanOutcome = "success" | "duplicate" | "denied" | "invalid" | "storage-error";

export interface ScanDecision {
  outcome: ScanOutcome;
  reason: string;
  holderName: string | null;
  // Present only when the scan admitted someone *and* was durably recorded. The caller adds
  // this to the admitted set, so a scan that failed to persist must never return one.
  admittedTicketId: string | null;
}

export interface RecordScanInput {
  code: string;
  eventId: string;
  blockedTicketIds: string[];
  checkedInTicketIds: string[];
}

export interface RecordScanDeps {
  verify: TicketVerifier;
  enqueue: (scan: QueuedScan) => Promise<unknown>;
  newId?: () => string;
  now?: () => Date;
}

/** The four checks, in order. A payload that fails verification has no trustworthy ticketId,
 *  so nothing is looked up until the signature passes. */
function judge(result: VerifiedTicket, eventId: string, blocked: string[], checkedIn: string[]) {
  if (!result.ok || !result.ticketId) {
    return { outcome: "invalid" as const, reason: result.reason ?? "Not a valid ticket", holderName: null };
  }
  if (result.eventId !== eventId) {
    return { outcome: "denied" as const, reason: "Ticket is for a different event", holderName: result.holderName };
  }
  if (blocked.includes(result.ticketId)) {
    return { outcome: "denied" as const, reason: "Ticket is void or refunded", holderName: result.holderName };
  }
  if (checkedIn.includes(result.ticketId)) {
    return { outcome: "duplicate" as const, reason: "Already checked in", holderName: result.holderName };
  }
  return { outcome: "success" as const, reason: "Checked in", holderName: result.holderName };
}

export async function recordScan(input: RecordScanInput, deps: RecordScanDeps): Promise<ScanDecision> {
  const { code, eventId, blockedTicketIds, checkedInTicketIds } = input;
  const { verify, enqueue, newId = () => crypto.randomUUID(), now = () => new Date() } = deps;

  const result = await verifyTicket(code, verify);
  const verdict = judge(result, eventId, blockedTicketIds, checkedInTicketIds);

  // Rejected scans are written too, so the log is a record of the night rather than a list
  // of admissions. A device that cannot record a refusal has also lost part of the audit.
  try {
    await enqueue({
      clientScanId: newId(),
      eventId,
      // The raw scanned string, never re-encoded: the server verifies the same bytes.
      ticketCode: code,
      scannedAt: now().toISOString(),
      localStatus: verdict.outcome,
      holderName: verdict.holderName,
      // Lets the admitted set be rebuilt from the queue after a reload.
      ticketId: result.ticketId,
    });
  } catch {
    // Nothing was written, so nothing may be claimed. Reported as a device fault rather than
    // as a verdict: storage failures here are not transient -- a full disk or a browser
    // blocking site data fails the same way on every following scan -- so a door that
    // admitted anyway would keep admitting and record none of it.
    return {
      outcome: "storage-error",
      reason: "This device could not record the scan. Do not admit; use another device.",
      holderName: null,
      admittedTicketId: null,
    };
  }

  return {
    ...verdict,
    admittedTicketId: verdict.outcome === "success" ? result.ticketId : null,
  };
}
