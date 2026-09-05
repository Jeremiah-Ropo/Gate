import { IEventInventoryReader, IEventInventorySnapshot } from "Modules/Event/entity/event-inventory.interface";

/** `remaining` mirrors the generated column: capacity - reserved - sold. */
export const makeSnapshot = (
  eventId: string,
  overrides: Partial<IEventInventorySnapshot> = {},
): IEventInventorySnapshot => {
  const capacity = overrides.capacity ?? 100;
  const reserved = overrides.reserved ?? 0;
  const sold = overrides.sold ?? 0;
  return {
    eventId,
    capacity,
    reserved,
    sold,
    remaining: overrides.remaining ?? capacity - reserved - sold,
  };
};

/** Stands in for Inventory. `calls` lets tests prove counters are read per request. */
export class FakeEventInventoryReader implements IEventInventoryReader {
  public calls = 0;

  constructor(private snapshots: IEventInventorySnapshot[] = []) {}

  async findByEventId(eventId: string): Promise<IEventInventorySnapshot | null> {
    this.calls += 1;
    return this.snapshots.find((snapshot) => snapshot.eventId === eventId) ?? null;
  }

  async findByEventIds(eventIds: string[]): Promise<Map<string, IEventInventorySnapshot>> {
    this.calls += 1;
    return new Map(
      this.snapshots
        .filter((snapshot) => eventIds.includes(snapshot.eventId))
        .map((snapshot) => [snapshot.eventId, snapshot]),
    );
  }
}
