import { sql, type SQL } from "drizzle-orm";
import { check, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { events } from "./event.schema";

// every event must create it's associated inventory in the same transaction
export const eventInventory = pgTable(
  "events_inventory",
  {
    eventId: uuid("event_id")
      .primaryKey()
      .references(() => events.id),
    reserved: integer("reserved").notNull().default(0),
    sold: integer("sold").notNull().default(0),
    capacity: integer("capacity").notNull(),
    // keeping this as a generated column, simplifies capacity updates
    remaining: integer("remaining").generatedAlwaysAs(
      (): SQL => sql`${eventInventory.capacity} - ${eventInventory.reserved} - ${eventInventory.sold}`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // any query that breaks our invariants should fail open
    check("events_inventory_reserved_non_negative", sql`${table.reserved} >= 0`),
    check("events_inventory_sold_non_negative", sql`${table.sold} >= 0`),
    check("events_inventory_capacity_non_negative", sql`${table.capacity} >= 0`),
    // reserved + sold should never exceed capacity
    check(
      "events_inventory_not_oversold",
      sql`${table.reserved} + ${table.sold} <= ${table.capacity}`,
    ),
  ],
);

export type EventInventory = typeof eventInventory.$inferSelect;
export type NewEventInventory = typeof eventInventory.$inferInsert;
