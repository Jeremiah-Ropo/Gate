import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EventStatusBadge } from "@/components/EventStatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/StatusMessage";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";

export function AdminEventsPage() {
  const client = useGateClient();
  const queryClient = useQueryClient();
  const {
    data: events,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["managed-events"],
    queryFn: client.listManagedEvents,
  });

  const deleteMutation = useMutation({
    mutationFn: client.deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-events"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
  });

  const mine = events ?? [];

  return (
    <div className="page-shell">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-neutral-900">Your events</h1>
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
      {deleteMutation.isError && <ErrorState message={errorMessage(deleteMutation.error)} />}
      {!isPending && !isError && mine.length === 0 && <EmptyState message="You haven't created any events yet." />}

      {mine.length > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Events", mine.length],
            ["Published", mine.filter((e) => e.status === "published").length],
            ["Drafts", mine.filter((e) => e.status === "draft").length],
          ].map(([label, value]) => (
            <div key={label} className="booking-panel">
              <p className="eyebrow">{label}</p>
              <p className="mt-3 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}
      {mine.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[650px] text-left text-sm">
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
                    {event.inventory
                      ? `${event.inventory.sold + event.inventory.reserved} / ${event.inventory.capacity}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <EventStatusBadge event={event} />
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link
                      to={`/admin/events/${event.id}/edit`}
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      Edit
                    </Link>
                    {event.status !== "cancelled" && (
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete “${event.name}”? It will be cancelled and removed from browse.`)) {
                            deleteMutation.mutate(event.id);
                          }
                        }}
                        className="font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
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
