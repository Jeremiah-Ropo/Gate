import { getEventAvailability } from "@/lib/eventStatus";
import type { GateEvent } from "@/types";

const LABEL: Record<ReturnType<typeof getEventAvailability>, string> = {
  active: "Active",
  "sold-out": "Sold out",
  closed: "Closed",
};

const STYLE: Record<ReturnType<typeof getEventAvailability>, string> = {
  active: "bg-green-50 text-green-700",
  "sold-out": "bg-amber-50 text-amber-700",
  closed: "bg-neutral-100 text-neutral-500",
};

const DOT: Record<ReturnType<typeof getEventAvailability>, string> = {
  active: "bg-green-500",
  "sold-out": "bg-amber-500",
  closed: "bg-neutral-400",
};

export function EventStatusBadge({ event }: { event: GateEvent }) {
  const availability = getEventAvailability(event);

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[availability]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[availability]}`} />
      {LABEL[availability]}
    </span>
  );
}
