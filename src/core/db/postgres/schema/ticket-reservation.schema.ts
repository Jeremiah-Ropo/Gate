import { sql } from "drizzle-orm";
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { paymentAttemptStatusEnum, reservationStatusEnum } from "./enums.schema";
import { events } from "./event.schema";
import { users } from "./user.schema";

export const ticketReservations = pgTable("ticket_reservations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  status: reservationStatusEnum("status").notNull().default("pending"),
  latestPaymentId: uuid("latest_payment_id"),
  paymentProcessingExpiresAt: timestamp("payment_processing_expires_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reservationPaymentAttempts = pgTable(
  "reservation_payment_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => ticketReservations.id),
    reference: varchar("reference", { length: 255 }).notNull().unique(),
    status: paymentAttemptStatusEnum("status").notNull().default("processing"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reservation_payment_attempts_one_processing")
      .on(table.reservationId)
      .where(sql`${table.status} = 'processing'`),
  ],
);

export type TicketReservation = typeof ticketReservations.$inferSelect;
export type NewTicketReservation = typeof ticketReservations.$inferInsert;
export type ReservationPaymentAttempt = typeof reservationPaymentAttempts.$inferSelect;
export type NewReservationPaymentAttempt = typeof reservationPaymentAttempts.$inferInsert;
