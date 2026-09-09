import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";

import { ErrorState, LoadingState } from "@/components/StatusMessage";
import { useAuth } from "@/context/AuthContext";
import { useDoorSession } from "@/lib/door/useDoorSession";
import { verifyTicket, type VerifiedTicket } from "@/lib/door/verifyTicket";

type Outcome = "success" | "duplicate" | "denied" | "invalid";

const OUTCOME_STYLE: Record<Outcome, string> = {
  success: "bg-green-600 text-white",
  duplicate: "bg-amber-500 text-white",
  denied: "bg-red-600 text-white",
  invalid: "bg-neutral-800 text-white",
};

interface Decision {
  outcome: Outcome;
  reason: string;
  holderName: string | null;
}

/**
 * Decides admission from the signature and the manifest alone -- no network, which is the
 * whole point. Order matters: a payload that fails verification has no trustworthy ticketId,
 * so nothing may be looked up until the signature has been checked.
 */
function decide(result: VerifiedTicket, eventId: string, blocked: string[], checkedIn: string[]): Decision {
  if (!result.ok || !result.ticketId) {
    return { outcome: "invalid", reason: result.reason ?? "Not a valid ticket", holderName: null };
  }
  if (result.eventId !== eventId) {
    return { outcome: "denied", reason: "Ticket is for a different event", holderName: result.holderName };
  }
  if (blocked.includes(result.ticketId)) {
    return { outcome: "denied", reason: "Ticket is void or refunded", holderName: result.holderName };
  }
  if (checkedIn.includes(result.ticketId)) {
    return { outcome: "duplicate", reason: "Already checked in", holderName: result.holderName };
  }
  return { outcome: "success", reason: "Checked in", holderName: result.holderName };
}

export function DoorScannerPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const { isPreview } = useAuth();
  const { manifest, verify, fromCache, error, isLoading, refresh } = useDoorSession(eventId);
  const [payload, setPayload] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  // Tickets admitted on this device since the manifest was fetched. Without it a second scan
  // of the same code would go green again until the next refresh.
  const [seen, setSeen] = useState<string[]>([]);

  if (isPreview) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorState message="The door is not available in preview: verifying a ticket needs a real public key from the server." />
      </div>
    );
  }

  if (isLoading) return <LoadingState label="Loading the door…" />;
  if (error || !manifest || !verify) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorState message={error ?? "This door could not be loaded."} />
      </div>
    );
  }

  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    const code = payload.trim();
    if (!code) return;

    const result = await verifyTicket(code, verify);
    const next = decide(result, eventId, manifest.blockedTicketIds, [...manifest.checkedInTicketIds, ...seen]);
    if (next.outcome === "success" && result.ticketId) {
      setSeen((prev) => [...prev, result.ticketId as string]);
    }
    setDecision(next);
    setPayload("");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{manifest.eventName}</h1>
          <p className="mt-1 text-xs text-neutral-500">
            {manifest.checkedInTicketIds.length + seen.length} checked in · {manifest.blockedTicketIds.length} blocked
            {fromCache ? " · offline, using the last loaded list" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Refresh
        </button>
      </div>

      {decision && (
        <div className={`mt-6 rounded-xl p-6 ${OUTCOME_STYLE[decision.outcome]}`}>
          <p className="text-sm font-medium uppercase tracking-wide opacity-80">{decision.outcome}</p>
          {/* Large on purpose: this is the name a staff member reads off against an ID. */}
          {decision.holderName && <p className="mt-1 text-3xl font-semibold">{decision.holderName}</p>}
          <p className="mt-2 text-sm opacity-90">{decision.reason}</p>
        </div>
      )}

      <form onSubmit={handleScan} className="mt-6 space-y-2">
        <label htmlFor="payload" className="text-sm font-medium text-neutral-700">
          Ticket code
        </label>
        <textarea
          id="payload"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={3}
          placeholder="Paste the scanned ticket code"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Check ticket
        </button>
        <p className="text-xs text-neutral-500">
          Verified on this device against the event&apos;s public key. Works with the network off.
        </p>
      </form>
    </div>
  );
}
