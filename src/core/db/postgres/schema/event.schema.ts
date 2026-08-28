import { integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { eventStatusEnum } from "./enums.schema";
import { users } from "./user.schema";

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: varchar("description", { length: 2000 }),
  venue: varchar("venue", { length: 255 }),
  address: varchar("address", { length: 500 }),
  coverImage: varchar("cover_image", { length: 512 }),
  starts_at: timestamp("starts_at", { withTimezone: true }).notNull(),
  // stored in the currency's major unit (e.g. whole naira), since the
  // mock payment provider doesn't need minor-unit precision
  ticketPrice: integer("ticket_price").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  status: eventStatusEnum("status").notNull().default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
