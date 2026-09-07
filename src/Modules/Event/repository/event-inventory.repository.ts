import { and, eq, gte, sql } from "drizzle-orm";

import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { IEventInventoryRepository } from "../entity/event-inventory.interface";
import { EventInventory, EventInventoryTable, NewEventInventory } from "../entity/event-inventory.model";

class EventInventoryRepository implements IEventInventoryRepository {
  private static instance: IEventInventoryRepository;

  constructor(private readonly executor?: DbExecutor) {}

  public static getInstance(): IEventInventoryRepository {
    if (!this.instance) {
      this.instance = new EventInventoryRepository();
    }
    return this.instance;
  }

  withTx(tx: DbTransaction): IEventInventoryRepository {
    return new EventInventoryRepository(tx);
  }

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async create(data: NewEventInventory): Promise<EventInventory> {
    const [inventory] = await this.db.insert(EventInventoryTable).values(data).returning();
    return inventory;
  }

  async findByEventId(eventId: string): Promise<EventInventory | null> {
    const [inventory] = await this.db
      .select()
      .from(EventInventoryTable)
      .where(eq(EventInventoryTable.eventId, eventId))
      .limit(1);
    return inventory ?? null;
  }

  async reserveTicket(eventId: string): Promise<EventInventory | null> {
    const [inventory] = await this.db
      .update(EventInventoryTable)
      .set({
        reserved: sql`${EventInventoryTable.reserved} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(EventInventoryTable.eventId, eventId), gte(EventInventoryTable.remaining, 1)))
      .returning();
    return inventory ?? null;
  }

  async sellReservedTicket(eventId: string): Promise<EventInventory | null> {
    const [inventory] = await this.db
      .update(EventInventoryTable)
      .set({
        reserved: sql`${EventInventoryTable.reserved} - 1`,
        sold: sql`${EventInventoryTable.sold} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(EventInventoryTable.eventId, eventId), gte(EventInventoryTable.reserved, 1)))
      .returning();
    return inventory ?? null;
  }

  async releaseReservedTicket(eventId: string): Promise<EventInventory | null> {
    const [inventory] = await this.db
      .update(EventInventoryTable)
      .set({
        reserved: sql`${EventInventoryTable.reserved} - 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(EventInventoryTable.eventId, eventId), gte(EventInventoryTable.reserved, 1)))
      .returning();
    return inventory ?? null;
  }

  async setCapacity(eventId: string, capacity: number): Promise<EventInventory | null> {
    const [inventory] = await this.db
      .update(EventInventoryTable)
      .set({
        capacity,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(EventInventoryTable.eventId, eventId),
          sql`${capacity} >= ${EventInventoryTable.reserved} + ${EventInventoryTable.sold}`,
        ),
      )
      .returning();
    return inventory ?? null;
  }
}

export default EventInventoryRepository.getInstance();
