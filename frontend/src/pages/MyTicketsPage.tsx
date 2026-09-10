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
  const {
    data: tickets,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.myTickets,
    queryFn: client.listMyTickets,
  });

  return (
    <div className="page-shell">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold text-neutral-900">My tickets</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your next experience starts here. Keep your ticket ready at the door.
        </p>
      </div>

      {isPending && <LoadingState label="Loading your tickets…" />}
      {isError && <ErrorState message={errorMessage(error)} />}
      {!isPending && !isError && tickets?.length === 0 && (
        <EmptyState message="No tickets yet — claim one from an event's page." />
      )}

      {tickets && tickets.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="ticket-card flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {ticket.status !== "valid" ? (
                <p className="max-w-48 text-sm text-neutral-500">
                  This ticket is {ticket.status} and cannot be used for admission.
                </p>
              ) : ticket.qrPayload.split(".").length === 4 ? (
                <QrCode value={ticket.qrPayload} size={160} />
              ) : (
                <p className="max-w-48 text-sm text-amber-700">
                  Signed QR not available yet. This ticket is not ready for door scanning.
                </p>
              )}
              <div className="flex-1 text-center sm:text-left">
                <p className="eyebrow mb-3">Your admission</p>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    STATUS_STYLE[ticket.status]
                  }`}
                >
                  {ticket.status}
                </span>
                <p className="mt-2 text-sm text-neutral-500">Issued {new Date(ticket.issuedAt).toLocaleDateString()}</p>
                <Link
                  to={`/events/${ticket.eventId}`}
                  className="mt-1 inline-block text-sm font-medium text-neutral-900"
                >
                  View event →
                </Link>
                <p className="mt-4 text-xs text-neutral-500">
                  Bring ID matching the name on your ticket. Staff verify your ticket at the door.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
