import { ApiError, type EventPayload } from "@/lib/api";
import { getPreviewStore, savePreviewStore } from "@/lib/previewStore";
import type { CheckIn, DoorEvent, EventStatus, GateEvent, GateTicket } from "@/types";

function notFound(what: string): never {
  throw new ApiError(`${what} not found`, 404);
}

function recalcRemaining(event: GateEvent) {
  if (!event.inventory) return;
  event.inventory.remaining = event.inventory.capacity - event.inventory.reserved - event.inventory.sold;
}

export async function listEvents(): Promise<GateEvent[]> {
  return getPreviewStore().events;
}

export async function getEvent(eventId: string): Promise<GateEvent> {
  const event = getPreviewStore().events.find((e) => e.id === eventId);
  if (!event) notFound("Event");
  return event;
}

export async function createEvent(payload: EventPayload, createdBy: string): Promise<GateEvent> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const event: GateEvent = {
    id,
    name: payload.name,
    slug: `${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id.slice(0, 6)}`,
    description: payload.description ?? null,
    venue: payload.venue ?? null,
    address: payload.address ?? null,
    coverImage: null,
    startsAt: payload.startsAt,
    ticketPrice: payload.ticketPrice,
    currency: payload.currency ?? "NGN",
    status: "draft",
    createdBy,
    createdAt: now,
    updatedAt: now,
    inventory: {
      eventId: id,
      capacity: payload.capacity,
      reserved: 0,
      sold: 0,
      remaining: payload.capacity,
      createdAt: now,
      updatedAt: now,
    },
  };
  getPreviewStore().events.push(event);
  savePreviewStore();
  return event;
}

export async function updateEvent(
  eventId: string,
  payload: Partial<EventPayload> & { status?: EventStatus },
): Promise<GateEvent> {
  const event = getPreviewStore().events.find((e) => e.id === eventId);
  if (!event) notFound("Event");
  if (payload.name !== undefined) event.name = payload.name;
  if (payload.description !== undefined) event.description = payload.description ?? null;
  if (payload.venue !== undefined) event.venue = payload.venue ?? null;
  if (payload.address !== undefined) event.address = payload.address ?? null;
  if (payload.startsAt !== undefined) event.startsAt = payload.startsAt;
  if (payload.ticketPrice !== undefined) event.ticketPrice = payload.ticketPrice;
  if (payload.currency !== undefined) event.currency = payload.currency;
  if (payload.status !== undefined) event.status = payload.status;
  event.updatedAt = new Date().toISOString();
  savePreviewStore();
  return event;
}

export async function claimTicket(eventId: string, ownerId: string): Promise<GateTicket> {
  const event = getPreviewStore().events.find((e) => e.id === eventId);
  if (!event) notFound("Event");
  if (event.inventory) {
    if (event.inventory.remaining <= 0) throw new ApiError("This event is sold out.", 409);
    event.inventory.sold += 1;
    recalcRemaining(event);
  }
  const now = new Date().toISOString();
  const ticket: GateTicket = {
    id: crypto.randomUUID(),
    eventId,
    reservationId: crypto.randomUUID(),
    ownerId,
    qrPayload: crypto.randomUUID(),
    status: "valid",
    issuedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const store = getPreviewStore();
  store.ticketsByOwner[ownerId] = [...(store.ticketsByOwner[ownerId] ?? []), ticket];
  savePreviewStore();
  return ticket;
}

export async function listMyTickets(ownerId: string): Promise<GateTicket[]> {
  return getPreviewStore().ticketsByOwner[ownerId] ?? [];
}

function findTicket(ticketId: string): GateTicket {
  const store = getPreviewStore();
  for (const tickets of Object.values(store.ticketsByOwner)) {
    const found = tickets.find((t) => t.id === ticketId);
    if (found) return found;
  }
  notFound("Ticket");
}

export async function getTicket(ticketId: string): Promise<GateTicket> {
  return findTicket(ticketId);
}

export async function voidTicket(ticketId: string): Promise<GateTicket> {
  const ticket = findTicket(ticketId);
  ticket.status = "void";
  ticket.updatedAt = new Date().toISOString();
  savePreviewStore();
  return ticket;
}

// The door is not available in preview: verification needs a real public key from the
// server's manifest, and the preview store has no signing key to produce one against.
export async function listMyDoorEvents(): Promise<DoorEvent[]> {
  return [];
}

export async function getCheckInsForTicket(ticketId: string): Promise<CheckIn[]> {
  return getPreviewStore().checkInsByTicket[ticketId] ?? [];
}
