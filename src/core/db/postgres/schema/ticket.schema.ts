import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { ticketStatusEnum } from "./enums.schema";
import { events } from "./event.schema";
import { users } from "./user.schema";

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  ownerName: varchar("owner_name", { length: 255 }).notNull(),
  ownerEmail: varchar("owner_email", { length: 255 }).notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  qrCodeUrl: varchar("qr_code_url", { length: 512 }),
  status: ticketStatusEnum("status").notNull().default("valid"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
