import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { QrCode } from "@/components/QrCode";
import { EmptyState, ErrorState, LoadingState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";
import type { TicketStatus } from "@/types";

const STATUS_STYLE: Record<TicketStatus, string> = {
  valid: "bg-green-50 text-green-700",
  void: "bg-neutral-100 text-neutral-500",
  refunded: "bg-amber-50 text-amber-700",
};

export function MyTicketsPage() {
  const client = useGateClient();
  const { data: tickets, isPending, isError, error } = useQuery({
    queryKey: queryKeys.myTickets,
    queryFn: client.listMyTickets,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">My tickets</h1>
        <p className="mt-1 text-sm text-neutral-500">Every ticket you've claimed, with its check-in QR code.</p>
      </div>

      {isPending && <LoadingState label="Loading your tickets…" />}
      {isError && <ErrorState message={errorMessage(error)} />}
      {!isPending && !isError && tickets?.length === 0 && (
        <EmptyState message="No tickets yet — claim one from an event's page." />
      )}

      {tickets && tickets.length > 0 && (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex flex-col items-center gap-4 rounded-lg border border-neutral-200 p-4 sm:flex-row sm:items-start"
            >
              <QrCode value={ticket.qrPayload} size={120} />
              <div className="flex-1 text-center sm:text-left">
                <span
                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[ticket.status]}`}
                >
                  {ticket.status}
                </span>
                <p className="mt-2 text-sm text-neutral-500">
                  Issued {new Date(ticket.issuedAt).toLocaleDateString()}
                </p>
                <Link to={`/events/${ticket.eventId}`} className="mt-1 inline-block text-sm font-medium text-neutral-900">
                  View event →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
