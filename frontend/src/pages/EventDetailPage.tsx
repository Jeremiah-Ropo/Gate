import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EventStatusBadge } from "@/components/EventStatusBadge";
import { QrCode } from "@/components/QrCode";
import { ErrorState, LoadingState } from "@/components/StatusMessage";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api";
import { isClaimable } from "@/lib/eventStatus";
import { formatDateTime, formatMoney } from "@/lib/format";
import { mockEvents } from "@/lib/mockEvents";
import { queryKeys } from "@/lib/queryClient";
import { useGateClient } from "@/lib/useGateClient";

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const client = useGateClient();

  const {
    data: fetchedEvent,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.event(eventId ?? ""),
    queryFn: () => client.getEvent(eventId as string),
    enabled: Boolean(eventId),
  });

  const claim = useMutation({
    mutationFn: () => client.claimTicket(eventId as string),
  });

  // Same fallback as BrowseEventsPage: when the API is unreachable, a card for a sample
  // event still has to open to something. A real 404 (bad id, API up) still errors normally.
  const mockEvent = isError ? mockEvents.find((e) => e.id === eventId) : undefined;
  const usingMockData = Boolean(mockEvent);
  const event = mockEvent ?? fetchedEvent;

  const claimable = event ? isClaimable(event) && !usingMockData : false;
  const isAttendee = !user || user.role === "attendee";

  if (isPending) return <LoadingState label="Loading event…" />;

  if (isError && !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState message={errorMessage(error)} />
      </div>
    );
  }
  if (!event) return null;

  const isPublished = event.status === "published";

  const handleGetTicket = () => {
    if (!isAuthenticated) {
      navigate(`/register?next=${encodeURIComponent(`/events/${event.id}`)}`);
      return;
    }
    claim.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Back to events
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="aspect-[16/7] w-full bg-neutral-100">
          {event.coverImage ? (
            <img src={event.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
              No cover image
            </div>
          )}
        </div>

        <div className="p-6">
          {usingMockData && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Sample event — the Gate API isn't reachable right now. Registering still works, but
              the final ticket claim is disabled since there's no real event to attach it to.
            </p>
          )}

          {!usingMockData && !isPublished && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              This event isn't open to the public yet.
            </p>
          )}

          {!usingMockData && isPublished && !claimable && (
            <p className="mb-4 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
              {event.inventory && event.inventory.remaining <= 0
                ? "This event is sold out."
                : "This event is closed — tickets can no longer be claimed."}
            </p>
          )}

          <div className="mb-2">
            <EventStatusBadge event={event} />
          </div>

          <h1 className="text-2xl font-semibold text-neutral-900">{event.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">{formatDateTime(event.startsAt)}</p>
          {event.venue && (
            <p className="mt-1 text-sm text-neutral-500">
              {event.venue}
              {event.address ? ` · ${event.address}` : ""}
            </p>
          )}

          {event.description && <p className="mt-4 whitespace-pre-line text-neutral-700">{event.description}</p>}

          <div className="mt-6 flex items-center justify-between rounded-lg border border-neutral-200 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Ticket price</p>
              <p className="text-lg font-semibold text-neutral-900">
                {formatMoney(event.ticketPrice, event.currency)}
              </p>
              {event.inventory && (
                <p className="mt-1 text-xs text-neutral-500">
                  {event.inventory.remaining > 0 ? `${event.inventory.remaining} of ${event.inventory.capacity} left` : "Sold out"}
                </p>
              )}
            </div>

            {claimable && isAttendee && !claim.data && (
              <button
                type="button"
                onClick={handleGetTicket}
                disabled={claim.isPending}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {claim.isPending ? "Claiming…" : isAuthenticated ? "Claim ticket" : "Get ticket"}
              </button>
            )}
          </div>

          {claimable && !isAttendee && (
            <p className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
              You're signed in as {user?.role}. Ticket claiming is for attendees — head to your{" "}
              <Link to={user?.role === "admin" ? "/admin/events" : "/staff/check-in"} className="font-medium text-neutral-900">
                dashboard
              </Link>
              .
            </p>
          )}

          {claim.isError && <div className="mt-4"><ErrorState message={errorMessage(claim.error)} /></div>}

          {claim.data && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
              <p className="font-medium text-green-800">You're in! Save this ticket.</p>
              <QrCode value={claim.data.qrPayload} />
              <p className="text-xs text-green-900">
                Show this QR code at the door — a staff member will scan it to check you in.
              </p>
              <Link to="/tickets" className="text-sm font-medium text-green-800 underline">
                View all my tickets
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
