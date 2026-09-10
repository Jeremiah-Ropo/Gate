import type {
  AuthSession,
  CheckIn,
  DoorEvent,
  DoorManifest,
  OfflineScan,
  SyncResponse,
  TicketReservation,
  EventStatus,
  GateEvent,
  GateTicket,
  GateUser,
} from "@/types";

const API_URL = import.meta.env?.VITE_API_URL ?? "http://localhost:8000/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorType?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Kept as module state rather than threaded through every call — every page needs it,
// and Gate's backend only issues one token per session, so there's nothing to disambiguate.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

interface EventProjection extends Omit<GateEvent, "inventory" | "status"> {
  status?: EventStatus;
  capacity: number | null;
  reserved: number | null;
  sold: number | null;
  remaining: number | null;
}

function eventView(row: EventProjection): GateEvent {
  return { ...row, status: row.status ?? "published", inventory: row.capacity === null ? null : {
    eventId: row.id, capacity: row.capacity, reserved: row.reserved!, sold: row.sold!, remaining: row.remaining!,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  } };
}

interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

interface ErrorEnvelope {
  errorType: string;
  errorMessage: string;
  success: false;
  errors: string[] | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  // no-store avoids Express ETag 304 responses with empty bodies, which fetch cannot parse.
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  const body = (await res.json().catch(() => null)) as SuccessEnvelope<T> | ErrorEnvelope | null;

  if (!res.ok || !body || body.success === false) {
    const message = body && "errorMessage" in body ? body.errorMessage : `Request failed (${res.status})`;
    const errorType = body && "errorType" in body ? body.errorType : undefined;
    throw new ApiError(message, res.status, errorType);
  }

  return body.data;
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}

// --- Public browse: no auth required ---

export function listEvents(): Promise<GateEvent[]> {
  return request<EventProjection[]>("/events").then(rows => rows.map(eventView));
}

export function getEvent(eventId: string): Promise<GateEvent> {
  return request<EventProjection>(`/events/${eventId}`).then(eventView);
}

// --- Auth: required to move past browsing into claiming a ticket. Every self-registered
// account is an "attendee" — the API has no field to request staff/admin at signup, since
// those are provisioned directly by whoever runs the org. ---

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export function register(payload: RegisterPayload): Promise<AuthSession> {
  return request<AuthSession>("/auth/register", {
    method: "POST",
    // The backend's idempotency middleware requires this on register (and on ticket claims
    // below) so an accidental double-submit or retry never creates a duplicate.
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe(): Promise<GateUser> {
  return request<GateUser>("/user/me");
}

// Reservations are the only issuance path. The server owns payment state.
export function createReservation(eventId: string, idempotencyKey: string): Promise<TicketReservation> {
  return request("/reservations", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ eventId }) });
}
export function getReservation(id: string): Promise<TicketReservation> { return request(`/reservations/${id}`); }
export function cancelReservation(id: string): Promise<TicketReservation> { return request(`/reservations/${id}`, { method: "DELETE" }); }
export type DemoPaymentOutcome = "success" | "declined" | "slow";
export function payReservation(id: string, outcome: DemoPaymentOutcome): Promise<TicketReservation> {
  const cards = { success: "4242424242424242", declined: "4000000000000002", slow: "4000000000003220" };
  return request(`/reservations/${id}/pay`, { method: "POST", body: JSON.stringify({ cardNumber: cards[outcome], cardholderName: "Demo Only", expiryMonth: 12, expiryYear: 2099, cvv: "123" }) });
}
export function listManagedEvents(): Promise<GateEvent[]> {
  return request<EventProjection[]>("/console/events").then(rows => rows.map(eventView));
}
export async function getManagedEvent(id: string): Promise<GateEvent> {
  const event = (await listManagedEvents()).find(row => row.id === id);
  if (!event) throw new ApiError("Event not found or not managed by you", 404);
  return event;
}

export function listMyTickets(): Promise<GateTicket[]> {
  return request<GateTicket[]>("/ticket/mine");
}

export function getTicket(ticketId: string): Promise<GateTicket> {
  return request<GateTicket>(`/ticket/${ticketId}`);
}

export function voidTicket(ticketId: string): Promise<GateTicket> {
  return request<GateTicket>(`/ticket/${ticketId}/void`, { method: "PUT" });
}

// --- Event management: staff/admin only. Allocating "capacity" creates the event's
// events_inventory row in the same request — there's no separate inventory-setup step. ---

export interface EventPayload {
  name: string;
  description?: string;
  venue?: string;
  address?: string;
  startsAt: string;
  ticketPrice: number;
  currency?: string;
  capacity: number;
}

export function createEvent(payload: EventPayload): Promise<GateEvent> {
  return request<GateEvent>("/event/publish", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export function updateEvent(
  eventId: string,
  payload: Partial<EventPayload> & { status?: EventStatus },
): Promise<GateEvent> {
  return request<GateEvent>(`/event/${eventId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function uploadEventCoverImage(eventId: string, file: File): Promise<GateEvent> {
  const form = new FormData();
  form.append("coverImage", file);
  return request<GateEvent>(`/event/${eventId}/cover-image`, {
    method: "POST",
    body: form,
  });
}

// --- Check-in: staff/admin only. A door is a signed-in staff member with an active
// membership for the event -- there is no device to register. ---

// The events this user is actually on the door for, which is what the door picker lists.
// Being staff is not the same as being on this event's door.
export function listMyDoorEvents(): Promise<DoorEvent[]> {
  return request<DoorEvent[]>("/event-members/my-events");
}

// Everything a door needs for a shift, fetched once. After this the device can decide
// admission on its own: the public key proves a ticket is genuine, and the two id lists
// cover the cases a signature cannot, because both describe things that changed after the
// ticket was signed.
export function getDoorSession(eventId: string): Promise<DoorManifest> {
  return request<DoorManifest>(`/check-in/events/${eventId}/session`);
}

// A batch of scans the door already decided on. Idempotency-Key so a retry after a dropped
// connection is free, and each scan carries its own clientScanId so the server can recognise
// one it has already recorded even if the whole batch is resent.
export function syncScans(eventId: string, scans: OfflineScan[]): Promise<SyncResponse> {
  return request<SyncResponse>(`/check-in/events/${eventId}/sync`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ scans }),
  });
}

export function getCheckInsForTicket(ticketId: string): Promise<CheckIn[]> {
  return request<CheckIn[]>(`/check-in/ticket/${ticketId}`);
}
