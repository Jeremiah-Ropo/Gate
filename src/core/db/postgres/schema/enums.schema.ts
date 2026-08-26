import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["attendee", "staff", "admin"]);

export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "cancelled", "completed"]);

export const ticketStatusEnum = pgEnum("ticket_status", ["valid", "checked_in", "void", "refunded"]);

export const checkInStatusEnum = pgEnum("check_in_status", ["success", "duplicate", "invalid", "denied"]);
