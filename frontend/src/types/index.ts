// Every type here mirrors a real column in Gate's Postgres schema (see the backend's
// src/core/db/postgres/schema/*.ts) — no invented fields (no phoneNumber, profilePicture,
// endDate, timezone, event-level capacity, or ticket ownerName/ownerEmail/code/qrCodeUrl),
// since none of those exist on the actual tables.

export type UserRole = "attendee" | "staff" | "admin";

export interface GateUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EventStatus = "draft" | "published" | "cancelled" | "completed";

// One row per event (events_inventory), created alongside it. `remaining` is a generated
// column (capacity - reserved - sold), never written directly.
export interface EventInventory {
  eventId: string;
  capacity: number;
  reserved: number;
  sold: number;
  remaining: number;
  createdAt: string;
  updatedAt: string;
}

export interface GateEvent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  venue: string | null;
  address: string | null;
  coverImage: string | null;
  startsAt: string;
  ticketPrice: number;
  currency: string;
  status: EventStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Public browse needs to show capacity/remaining, so the event read model embeds its
  // inventory row. Null only for an event whose inventory row hasn't been created yet.
  inventory: EventInventory | null;
}

export type ReservationStatus = "pending" | "paid" | "expired" | "cancelled";

export interface TicketReservation {
  id: string;
  userId: string;
  eventId: string;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type TicketStatus = "valid" | "void" | "refunded";

export interface GateTicket {
  id: string;
  eventId: string;
  reservationId: string;
  ownerId: string;
  // Opaque payload encoded into the ticket's QR code; the door scanner decodes this, not a
  // human-typed "code". Rendered client-side into an actual QR image (see components/QrCode).
  qrPayload: string;
  status: TicketStatus;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInDevice {
  id: string;
  eventId: string;
  name: string;
  location: string | null;
  deviceKey: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CheckInStatus = "success" | "duplicate" | "invalid" | "denied";

export interface CheckIn {
  id: string;
  ticketId: string | null;
  scannedCode: string;
  deviceId: string;
  scannedBy: string | null;
  status: CheckInStatus;
  scannedAt: string;
  syncedAt: string;
  isOfflineSync: boolean;
  clientScanId: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  refreshToken: string;
  user: GateUser;
}

export interface RegisterResult {
  sessionId: string;
  resendTokenSessionId: string;
}
