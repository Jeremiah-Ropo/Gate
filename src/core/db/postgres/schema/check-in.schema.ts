import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { checkInStatusEnum } from "./enums.schema";
import { checkInDevices } from "./check-in-device.schema";
import { tickets } from "./ticket.schema";
import { users } from "./user.schema";

export const checkIns = pgTable("check_ins", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Nullable so a scan of an unrecognized/invalid code can still be persisted for audit,
  // even though there is no ticket row to reference.
  ticketId: uuid("ticket_id").references(() => tickets.id),
  scannedCode: varchar("scanned_code", { length: 64 }).notNull(),
  deviceId: uuid("device_id")
    .notNull()
    .references(() => checkInDevices.id),
  scannedBy: uuid("scanned_by").references(() => users.id),
  status: checkInStatusEnum("status").notNull(),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  isOfflineSync: boolean("is_offline_sync").notNull().default(false),
  // Client-generated id from the scanning device — the idempotency key that lets a batch
  // sync be retried safely without double-counting a scan recorded while offline.
  clientScanId: uuid("client_scan_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CheckIn = typeof checkIns.$inferSelect;
export type NewCheckIn = typeof checkIns.$inferInsert;
