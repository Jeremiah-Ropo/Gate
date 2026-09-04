import { eq, inArray } from "drizzle-orm";

import { getDb } from "core/db/postgres";
import { eventInventory } from "core/db/postgres/schema";
import { IEventInventoryReader, IEventInventorySnapshot } from "../entity/event-inventory.interface";

/**
 * Read-only access to Inventory's table. `remaining` is a generated column, so it is read rather
 * than derived here — Postgres is the only thing that computes it.
 */
class EventInventoryReader implements IEventInventoryReader {
  private static instance: IEventInventoryReader;

  public static getInstance(): IEventInventoryReader {
    if (!this.instance) {
      this.instance = new EventInventoryReader();
    }
    return this.instance;
  }

  async findByEventId(eventId: string): Promise<IEventInventorySnapshot | null> {
    const [row] = await getDb().select().from(eventInventory).where(eq(eventInventory.eventId, eventId)).limit(1);
    return row ? toSnapshot(row) : null;
  }

  async findByEventIds(eventIds: string[]): Promise<Map<string, IEventInventorySnapshot>> {
    if (eventIds.length === 0) {
      return new Map();
    }
    const rows = await getDb().select().from(eventInventory).where(inArray(eventInventory.eventId, eventIds));
    return new Map(rows.map((row) => [row.eventId, toSnapshot(row)]));
  }
}

type InventoryRow = typeof eventInventory.$inferSelect;

const toSnapshot = (row: InventoryRow): IEventInventorySnapshot => ({
  eventId: row.eventId,
  capacity: row.capacity,
  reserved: row.reserved,
  sold: row.sold,
  // `remaining` is nullable in the inferred type because it is generated; Postgres always supplies
  // it, and falling back to the same arithmetic keeps the projection total rather than null.
  remaining: row.remaining ?? row.capacity - row.reserved - row.sold,
});

export default EventInventoryReader.getInstance();
