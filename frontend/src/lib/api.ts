import type {
  AuthSession,
  CheckIn,
  DoorEvent,
  DoorManifest,
  EventStatus,
  GateEvent,
  GateTicket,
  GateUser,
} from "@/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/v1";

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

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
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
  return request<GateEvent[]>("/event");
}

export function getEvent(eventId: string): Promise<GateEvent> {
  return request<GateEvent>(`/event/${eventId}`);
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

// --- Claiming a ticket: requires an authenticated attendee session. The ticket's owner is
// the signed-in user (ownerId, from the JWT) — there's no ownerName/ownerEmail on the
// tickets table, so nothing else needs to be collected at claim time. ---

export function claimTicket(eventId: string): Promise<GateTicket> {
  return request<GateTicket>("/ticket", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ eventId }),
  });
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
  return request<GateEvent>("/event", {
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

export function getCheckInsForTicket(ticketId: string): Promise<CheckIn[]> {
  return request<CheckIn[]>(`/check-in/ticket/${ticketId}`);
}
