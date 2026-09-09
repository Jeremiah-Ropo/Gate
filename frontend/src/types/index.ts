// API view models used by the browser.

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
  description: string | null;
  venue: string | null;
  address: string | null;
  coverImage: string | null;
  startsAt: string;
  ticketPrice: number;
  currency: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  // Public browse needs to show capacity/remaining, so the event read model embeds its
  // inventory row. Null only for an event whose inventory row hasn't been created yet.
  inventory: EventInventory | null;
}

export type ReservationStatus = "pending" | "payment_processing" | "paid" | "expired" | "cancelled";

export interface TicketReservation {
  ticketId: string | null;
  paymentProcessingExpiresAt: string | null;
  lastPayment: { status: "processing" | "succeeded" | "failed"; attemptedAt: string; updatedAt: string } | null;
  id: string;
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
