import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["attendee", "staff", "admin"]);

export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "cancelled", "completed"]);

export const ticketStatusEnum = pgEnum("ticket_status", ["valid", "void", "refunded"]);

export const reservationStatusEnum = pgEnum("reservation_status", ["pending", "paid", "expired", "cancelled"]);

export const checkInStatusEnum = pgEnum("check_in_status", ["success", "duplicate", "invalid", "denied"]);

// Event-level roles, distinct from the global users.role. Someone who scans at the door is
// not necessarily staff across the whole system, and vice versa.
export const eventMemberRoleEnum = pgEnum("event_member_role", ["door_staff", "organizer"]);

// Revoked rather than deleted: the scan log needs a member to point at, and an event
// should keep a record of everyone who was ever able to work its door.
export const membershipStatusEnum = pgEnum("membership_status", ["active", "revoked"]);
