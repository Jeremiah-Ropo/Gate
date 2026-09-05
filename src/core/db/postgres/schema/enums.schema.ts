import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["attendee", "staff", "admin"]);

export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "cancelled", "completed"]);

export const ticketStatusEnum = pgEnum("ticket_status", ["valid", "void", "refunded"]);

export const reservationStatusEnum = pgEnum("reservation_status", ["pending", "paid", "expired", "cancelled"]);

export const checkInStatusEnum = pgEnum("check_in_status", ["success", "duplicate", "invalid", "denied"]);
