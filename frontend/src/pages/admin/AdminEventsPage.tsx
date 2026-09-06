import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EventStatusBadge } from "@/components/EventStatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/StatusMessage";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";

export function AdminEventsPage() {
  const { user } = useAuth();
  const client = useGateClient();
  const { data: events, isPending, isError, error } = useQuery({
    queryKey: queryKeys.events,
    queryFn: client.listEvents,
  });

  // GET /event returns every event site-wide; an event can only be edited by whoever
  // created it (backend enforces this via ownership, not role), so this dashboard only
  // lists — and only lets you act on — events this admin created.
  const mine = (events ?? []).filter((event) => event.createdBy === user?.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Manage events</h1>
          <p className="mt-1 text-sm text-neutral-500">Create events and allocate how many tickets each one has.</p>
        </div>
        <Link
          to="/admin/events/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          New event
        </Link>
      </div>

      {isPending && <LoadingState label="Loading events…" />}
      {isError && <ErrorState message={errorMessage(error)} />}
      {!isPending && !isError && mine.length === 0 && (
        <EmptyState message="You haven't created any events yet." />
      )}

      {mine.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Starts</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Tickets</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {mine.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3 font-medium text-neutral-900">{event.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{formatDateTime(event.startsAt)}</td>
                  <td className="px-4 py-3 text-neutral-600">{formatMoney(event.ticketPrice, event.currency)}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {event.inventory ? `${event.inventory.sold + event.inventory.reserved} / ${event.inventory.capacity}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <EventStatusBadge event={event} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/events/${event.id}/edit`} className="font-medium text-neutral-900 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
