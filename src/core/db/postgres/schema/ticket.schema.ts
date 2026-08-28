import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { ticketStatusEnum } from "./enums.schema";
import { events } from "./event.schema";
import { ticketReservations } from "./ticket-reservation.schema";
import { users } from "./user.schema";

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  reservationId: uuid("reservation_id")
    .notNull()
    .unique()
    .references(() => ticketReservations.id),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  qrPayload: text("qr_payload").notNull().unique(),
  status: ticketStatusEnum("status").notNull().default("valid"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
