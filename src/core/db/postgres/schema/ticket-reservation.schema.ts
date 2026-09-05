import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { reservationStatusEnum } from "./enums.schema";
import { events } from "./event.schema";
import { users } from "./user.schema";

export const ticketReservations = pgTable(
  "ticket_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    status: reservationStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type TicketReservation = typeof ticketReservations.$inferSelect;
export type NewTicketReservation = typeof ticketReservations.$inferInsert;
