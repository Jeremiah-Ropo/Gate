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

// One row of GET /event-members/my-events: an event this user may work the door for.
export interface DoorEvent {
  eventId: string;
  eventName: string;
  startsAt: string;
  venue: string | null;
  role: "door_staff" | "organizer";
  status: "active" | "revoked";
}

// GET /check-in/events/:eventId/session. Carries exceptions, never the guest list: anything
// with a valid signature for this event is admissible, so only the tickets that are genuine
// but must not get in have to travel.
export interface DoorManifest {
  eventId: string;
  eventName: string;
  // Base64-encoded PEM. Verifies signatures, cannot produce them.
  publicKey: string;
  issuedAt: string;
  checkedInTicketIds: string[];
  blockedTicketIds: string[];
}

export type CheckInStatus = "success" | "duplicate" | "invalid" | "denied";

// What POST /check-in/events/:eventId/sync takes and returns.
export interface OfflineScan {
  clientScanId: string;
  ticketCode: string;
  scannedAt: string;
}

export interface ScanResult {
  clientScanId: string;
  status: CheckInStatus;
  message: string;
  ticketId: string | null;
}

export interface CheckIn {
  id: string;
  ticketId: string | null;
  scannedCode: string;
  eventId: string;
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
