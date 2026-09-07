import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { EventStatusBadge } from "@/components/EventStatusBadge";
import { useAuth } from "@/context/AuthContext";
import { isClaimable } from "@/lib/eventStatus";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { GateEvent } from "@/types";

export function EventCard({ event }: { event: GateEvent }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const claimable = isClaimable(event);
  // Staff/admin browsing don't claim tickets — that's an attendee action — so the card only
  // offers this to a signed-out visitor (who's about to become one) or a signed-in attendee.
  const canClaim = claimable && (!user || user.role === "attendee");

  const handleClaim = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate(`/register?next=${encodeURIComponent(`/events/${event.id}`)}`);
      return;
    }
    // The actual one-click claim lives on the event detail page (it needs the full inventory
    // context to know if it's still available) — this button's job is just to get an
    // unauthenticated visitor through login/register and land back here.
    navigate(`/events/${event.id}`);
  };

  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-neutral-300 hover:shadow-md"
    >
      <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-100">
        {event.coverImage ? (
          <img
            src={event.coverImage}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">No cover image</div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <EventStatusBadge event={event} />
        <h3 className="line-clamp-2 font-semibold text-neutral-900">{event.name}</h3>
        <p className="text-sm text-neutral-500">{formatDateTime(event.startsAt)}</p>
        {event.venue && <p className="text-sm text-neutral-500">{event.venue}</p>}
        {event.inventory && (
          <p className="text-xs text-neutral-400">
            {event.inventory.remaining > 0 ? `${event.inventory.remaining} tickets left` : "Sold out"}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm font-medium">
          <span className="text-neutral-900">{formatMoney(event.ticketPrice, event.currency)}</span>
          {canClaim ? (
            <button
              type="button"
              onClick={handleClaim}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
            >
              {isAuthenticated ? "Claim ticket" : "Get ticket"}
            </button>
          ) : (
            <span className="text-neutral-400 group-hover:text-neutral-700">View event →</span>
          )}
        </div>
      </div>
    </Link>
  );
}
