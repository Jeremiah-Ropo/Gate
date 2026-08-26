import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { events } from "./event.schema";

export const checkInDevices = pgTable("check_in_devices", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  deviceKey: varchar("device_key", { length: 64 }).notNull().unique(),
  deviceSecretHash: varchar("device_secret_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CheckInDevice = typeof checkInDevices.$inferSelect;
export type NewCheckInDevice = typeof checkInDevices.$inferInsert;
