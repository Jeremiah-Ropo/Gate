import { IEventInventoryRepository } from "Modules/Event/entity/event-inventory.interface";
import { EventInventory, NewEventInventory } from "Modules/Event/entity/event-inventory.model";

/** `remaining` mirrors the generated column: capacity - reserved - sold. */
export const makeInventory = (eventId: string, overrides: Partial<EventInventory> = {}): EventInventory => {
  const capacity = overrides.capacity ?? 100;
  const reserved = overrides.reserved ?? 0;
  const sold = overrides.sold ?? 0;
  return {
    eventId,
    capacity,
    reserved,
    sold,
    remaining: overrides.remaining ?? capacity - reserved - sold,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
};

/** Stands in for Inventory's repository. `calls` lets tests prove counters are read per request. */
export class FakeEventInventoryRepository implements IEventInventoryRepository {
  public calls = 0;
  public created: NewEventInventory[] = [];

  constructor(private rows: EventInventory[] = []) {}

  withTx(): IEventInventoryRepository {
    return this;
  }

  async create(data: NewEventInventory): Promise<EventInventory> {
    this.created.push(data);
    const row = makeInventory(data.eventId, { capacity: data.capacity });
    this.rows.push(row);
    return row;
  }

  async findByEventId(eventId: string): Promise<EventInventory | null> {
    this.calls += 1;
    return this.rows.find((row) => row.eventId === eventId) ?? null;
  }

  async findByEventIds(eventIds: string[]): Promise<Map<string, EventInventory>> {
    this.calls += 1;
    return new Map(this.rows.filter((row) => eventIds.includes(row.eventId)).map((row) => [row.eventId, row]));
  }

  async reserveTicket(): Promise<EventInventory | null> {
    return null;
  }

  async sellReservedTicket(): Promise<EventInventory | null> {
    return null;
  }

  async releaseReservedTicket(): Promise<EventInventory | null> {
    return null;
  }

  async setCapacity(): Promise<EventInventory | null> {
    return null;
  }
}
