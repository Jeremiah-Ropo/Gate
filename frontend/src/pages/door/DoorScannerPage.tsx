import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";

import { ErrorState, LoadingState } from "@/components/StatusMessage";
import { useDoorSession } from "@/lib/door/useDoorSession";
import { enqueue, pendingFor } from "@/lib/door/scanQueue";
import { useScanSync } from "@/lib/door/useScanSync";
import { recordScan, type ScanDecision, type ScanOutcome } from "@/lib/door/recordScan";

const OUTCOME_STYLE: Record<ScanOutcome, string> = {
  success: "bg-green-600 text-white",
  duplicate: "bg-amber-500 text-white",
  denied: "bg-red-600 text-white",
  invalid: "bg-neutral-800 text-white",
  // Deliberately not a verdict colour. The device is broken, not the ticket.
  "storage-error": "bg-red-800 text-white",
};

// "storage-error" is the internal name; staff need to read the state at a glance in bad light.
const OUTCOME_LABEL: Record<ScanOutcome, string> = {
  success: "success",
  duplicate: "duplicate",
  denied: "denied",
  invalid: "invalid",
  "storage-error": "cannot record",
};

export function DoorScannerPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const { manifest, verify, fromCache, error, isLoading, refresh } = useDoorSession(eventId);
  const [payload, setPayload] = useState("");
  const [decision, setDecision] = useState<ScanDecision | null>(null);

  /**
   * Every ticket this device treats as already admitted. Only ever grows, and is only ever
   * merged into -- from the manifest at the start of a shift, from the server on each sync,
   * and from this device's own scans.
   *
   * Replacing it would be a bug rather than a simplification: an admission this device made
   * but has not synced is still a person inside the venue, and forgetting them would let the
   * same ticket go green a second time.
   */
  const [seen, setSeen] = useState<string[]>([]);
  const admit = useCallback((ticketIds: string[]) => {
    setSeen((prev) => [...new Set([...prev, ...ticketIds])]);
  }, []);

  const { pending, conflicts, isOnline, isSyncing, sync, refreshCount } = useScanSync(eventId, admit);

  // Rebuilt from durable storage rather than starting empty, so a refresh or a killed app
  // mid-shift does not make the door forget who it let in. The queue is the record: a
  // success is written there before the screen reports admission.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const queued = await pendingFor(eventId);
      const admitted = queued.filter((scan) => scan.localStatus === "success").map((scan) => scan.ticketId);
      if (!cancelled) admit(admitted.filter((id): id is string => Boolean(id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, admit]);

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

    // recordScan writes the scan down before it reports one, so nothing below this line can
    // show a green screen for an admission that was never recorded.
    const next = await recordScan(
      {
        code,
        eventId,
        blockedTicketIds: manifest.blockedTicketIds,
        checkedInTicketIds: [...manifest.checkedInTicketIds, ...seen],
      },
      { verify, enqueue },
    );

    if (next.admittedTicketId) {
      admit([next.admittedTicketId]);
    }
    setDecision(next);
    setPayload("");

    await refreshCount();
    void sync();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{manifest.eventName}</h1>
          <p className="mt-1 text-xs text-neutral-500">
            {new Set([...manifest.checkedInTicketIds, ...seen]).size} checked in · {manifest.blockedTicketIds.length} blocked
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

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs">
        <span className={`inline-flex h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-neutral-400"}`} />
        <span className="text-neutral-700">{isOnline ? "Online" : "Offline"}</span>
        <span className="text-neutral-400">·</span>
        <span className="text-neutral-700">{pending} waiting to sync</span>
        {isSyncing && <span className="text-neutral-500">syncing…</span>}
        {isOnline && pending > 0 && !isSyncing && (
          <button type="button" onClick={() => void sync()} className="ml-auto font-medium text-neutral-900 underline">
            Sync now
          </button>
        )}
      </div>

      {decision && (
        <div className={`mt-6 rounded-xl p-6 ${OUTCOME_STYLE[decision.outcome]}`}>
          <p className="text-sm font-medium uppercase tracking-wide opacity-80">{OUTCOME_LABEL[decision.outcome]}</p>
          {/* Large on purpose: this is the name a staff member reads off against an ID. */}
          {decision.holderName && <p className="mt-1 text-3xl font-semibold">{decision.holderName}</p>}
          <p className="mt-2 text-sm opacity-90">{decision.reason}</p>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {conflicts.length} scan{conflicts.length === 1 ? "" : "s"} the server disagreed with
          </p>
          {/* The design accepts that two offline doors can both admit one ticket and detects
              it on sync rather than preventing it. A conflict nobody can see is not detected,
              so it goes on the screen. */}
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {conflicts.map((conflict) => (
              <li key={conflict.clientScanId}>
                {conflict.holderName ?? "Unknown holder"} — this door said {conflict.localStatus}, the server recorded{" "}
                {conflict.serverStatus} ({conflict.message})
              </li>
            ))}
          </ul>
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
