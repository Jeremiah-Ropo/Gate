import { Link } from "react-router-dom";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { GateEvent } from "@/types";

export function EventCard({ event }: { event: GateEvent }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white hover:border-emerald-700"
    >
      <div className="flex aspect-[16/10] items-center justify-center overflow-hidden bg-[#e4ebe3]">
        {event.coverImage ? (
          <img src={event.coverImage} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="font-serif text-4xl text-emerald-900">See you there.</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">{formatDateTime(event.startsAt)}</p>
          <EventStatusBadge event={event} />
        </div>
        <h3 className="text-xl font-semibold">{event.name}</h3>
        <p className="text-sm text-neutral-500">{event.venue || "Venue to be announced"}</p>
        <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-4">
          <span className="font-semibold">{formatMoney(event.ticketPrice, event.currency)}</span>
          <span aria-label="View event" className="rounded-full border border-neutral-200 px-3 py-1">
            ↗
          </span>
        </div>
      </div>
    </Link>
  );
}
