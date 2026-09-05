import { IEventInventorySnapshot } from "./event-inventory.interface";
import { IConsoleEventRow, IPublishedEventDescriptor, IPublishedEventProjection } from "./event.interface";
import { Event } from "./event.model";

/**
 * Projects a stored row onto the event-owned fields this slice publishes. Selecting explicitly
 * rather than spreading the row keeps internals — slug, createdBy, ticketPrice, coverImage — out
 * of the contract, so a column added later is opt-in instead of leaked by default.
 */
export const toDescriptor = (event: Event): IPublishedEventDescriptor => ({
  id: event.id,
  name: event.name,
  description: event.description,
  venue: event.venue,
  startsAt: event.starts_at,
});

/** Absent inventory is reported as null, never as 0 — 0 would read as sold out. */
export const toProjection = (
  descriptor: IPublishedEventDescriptor,
  inventory: IEventInventorySnapshot | null,
): IPublishedEventProjection => ({
  ...descriptor,
  capacity: inventory ? inventory.capacity : null,
  reserved: inventory ? inventory.reserved : null,
  remaining: inventory ? inventory.remaining : null,
  sold: inventory ? inventory.sold : null,
});

export const toConsoleRow = (event: Event, inventory: IEventInventorySnapshot | null): IConsoleEventRow => ({
  ...toProjection(toDescriptor(event), inventory),
  status: event.status,
});
