import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { ErrorState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { useGateClient } from "@/lib/useGateClient";
import type { CheckIn, GateTicket, TicketStatus } from "@/types";

const TICKET_STATUS_STYLE: Record<TicketStatus, string> = {
  valid: "bg-green-50 text-green-700",
  void: "bg-neutral-100 text-neutral-500",
  refunded: "bg-amber-50 text-amber-700",
};

function TicketLookup() {
  const client = useGateClient();
  const [ticketId, setTicketId] = useState("");
  const [result, setResult] = useState<{ ticket: GateTicket; checkIns: CheckIn[] } | null>(null);

  const lookup = useMutation({
    mutationFn: async (id: string) => {
      const [ticket, checkIns] = await Promise.all([client.getTicket(id), client.getCheckInsForTicket(id)]);
      return { ticket, checkIns };
    },
    onSuccess: setResult,
  });

  const void_ = useMutation({
    mutationFn: (id: string) => client.voidTicket(id),
    onSuccess: (ticket) => setResult((prev) => (prev ? { ...prev, ticket } : prev)),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (ticketId.trim()) lookup.mutate(ticketId.trim());
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="font-semibold text-neutral-900">Look up a ticket</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Paste a ticket ID to inspect its record. Looking up a ticket does not record admission.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap gap-2">
        <input
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          placeholder="Ticket ID"
          aria-label="Ticket ID"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={lookup.isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {lookup.isPending ? "Looking up…" : "Look up"}
        </button>
      </form>

      {lookup.isError && (
        <div className="mt-3">
          <ErrorState message={errorMessage(lookup.error)} />
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                TICKET_STATUS_STYLE[result.ticket.status]
              }`}
            >
              {result.ticket.status}
            </span>
            {result.ticket.status === "valid" && (
              <button
                type="button"
                onClick={() => void_.mutate(result.ticket.id)}
                disabled={void_.isPending}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {void_.isPending ? "Voiding…" : "Void ticket"}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500">Issued {new Date(result.ticket.issuedAt).toLocaleString()}</p>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-neutral-500">Scan history</p>
          {result.checkIns.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-500">No scans recorded yet.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-neutral-700">
              {result.checkIns.map((c) => (
                <li key={c.id}>
                  {c.status} · {new Date(c.scannedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CheckInPage() {
  return (
    <div className="page-shell">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold text-neutral-900">Door check-in</h1>
        <p className="mt-1 text-sm text-neutral-500">Inspect ticket records and scan history.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TicketLookup />
        <p className="rounded-xl border p-5 text-sm">
          Door access uses event membership and your staff login. The device registry has been removed. Offline scanning
          and sync are being integrated by the Check-in slice; this lookup does not admit anyone.
        </p>
      </div>
    </div>
  );
}
