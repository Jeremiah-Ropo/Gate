import type { GateEvent } from "@/types";

export type EventAvailability = "active" | "sold-out" | "closed";

// The schema has no endDate — an event's lifecycle is the `status` enum itself
// (draft/published/cancelled/completed), set explicitly by whoever manages it, not derived
// from a clock. "Active" means a visitor can still claim a ticket for it right now.
export function getEventAvailability(event: GateEvent): EventAvailability {
  if (event.status !== "published") return "closed";
  if (event.inventory && event.inventory.remaining <= 0) return "sold-out";
  return "active";
}

export function isClaimable(event: GateEvent): boolean {
  return getEventAvailability(event) === "active";
}
