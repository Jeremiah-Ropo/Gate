import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { checkInStatusEnum } from "./enums.schema";
import { events } from "./event.schema";
import { tickets } from "./ticket.schema";
import { users } from "./user.schema";

export const checkIns = pgTable(
  "check_ins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Nullable so a scan of an unrecognized/invalid code can still be persisted for audit,
    // even though there is no ticket row to reference.
    ticketId: uuid("ticket_id").references(() => tickets.id),
    // Denormalized from the ticket on purpose: an invalid scan has no ticket to join
    // through, but it still happened at a known event and belongs in that event's log.
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    // Text, not varchar(64): a signed payload is <uuid>.<uuid>.<base64 signature>, roughly
    // 160 characters, and the raw scanned string is kept verbatim for audit.
    scannedCode: text("scanned_code").notNull(),
    // Who scanned, not what scanned. A door is a logged-in staff member, so every scan is
    // attributable to a person — which is what ADR 0007 needs to report a conflict as
    // "admitted at door A by X, then at door B by Y".
    scannedBy: uuid("scanned_by")
      .notNull()
      .references(() => users.id),
    status: checkInStatusEnum("status").notNull(),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    isOfflineSync: boolean("is_offline_sync").notNull().default(false),
    // Client-generated id from the scanning device — the idempotency key that lets a batch
    // sync be retried safely without double-counting a scan recorded while offline.
    clientScanId: uuid("client_scan_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One admission per ticket, enforced by the database rather than by application logic:
    // two doors that were offline together will both try to insert a success, and the
    // second must fail here so it can be recorded as a conflict. Partial, because the
    // rejected scans of the same ticket are expected and must all be kept.
    uniqueIndex("check_ins_one_success_per_ticket")
      .on(table.ticketId)
      .where(sql`${table.status} = 'success'`),
    // Serves the check-in session manifest: the admitted-ticket list for one event.
    index("check_ins_event_status_idx").on(table.eventId, table.status),
  ],
);

export type CheckIn = typeof checkIns.$inferSelect;
export type NewCheckIn = typeof checkIns.$inferInsert;
