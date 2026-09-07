import type {
  AuthSession,
  CheckIn,
  CheckInDevice,
  EventStatus,
  GateEvent,
  GateTicket,
  GateUser,
  RegisterResult,
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

export function register(payload: RegisterPayload): Promise<RegisterResult> {
  return request<RegisterResult>("/auth/register", {
    method: "POST",
    // The backend's idempotency middleware requires this on register (and on ticket claims
    // below) so an accidental double-submit or retry never creates a duplicate.
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export function verifyEmail(payload: { sessionId: string; token: string }): Promise<AuthSession> {
  return request<AuthSession>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resendVerification(resendTokenSessionId: string): Promise<RegisterResult> {
  return request<RegisterResult>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ resendTokenSessionId }),
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

// --- Check-in: staff/admin only. Devices are the physical/handheld scanners used at the
// door; this app only registers and manages them (and looks up a ticket's scan history) —
// the actual offline scan-and-sync loop runs on the device itself, authenticated separately
// with its own device token, not a staff user's session. ---

export function listCheckInDevices(eventId: string): Promise<CheckInDevice[]> {
  return request<CheckInDevice[]>(`/check-in/devices/event/${eventId}`);
}

export function registerCheckInDevice(payload: {
  eventId: string;
  name: string;
  location?: string;
}): Promise<{ device: CheckInDevice; deviceSecret: string }> {
  return request<{ device: CheckInDevice; deviceSecret: string }>("/check-in/devices", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export function deactivateCheckInDevice(deviceId: string): Promise<CheckInDevice> {
  return request<CheckInDevice>(`/check-in/devices/${deviceId}/deactivate`, { method: "PUT" });
}

export function getCheckInsForTicket(ticketId: string): Promise<CheckIn[]> {
  return request<CheckIn[]>(`/check-in/ticket/${ticketId}`);
}
