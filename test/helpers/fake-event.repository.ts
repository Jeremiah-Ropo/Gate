import { IEventRepository } from "Modules/Event/entity/event.interface";
import { Event, NewEvent } from "Modules/Event/entity/event.model";

/**
 * Builds a complete event row. Tests override only the fields under test, so a column added to
 * the schema shows up here once rather than in every test.
 */
export const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Lagos Tech Summit",
  slug: "lagos-tech-summit",
  description: null,
  venue: null,
  address: null,
  coverImage: null,
  starts_at: new Date("2026-03-01T09:00:00.000Z"),
  ticketPrice: 0,
  currency: "NGN",
  status: "published",
  createdBy: "22222222-2222-4222-8222-222222222222",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

/**
 * In-memory stand-in for the Drizzle repository. The read methods mirror the real queries — same
 * filters, same starts_at-ascending order — so the projection can be exercised without Postgres.
 */
export class FakeEventRepository implements IEventRepository {
  public reads = 0;
  /** Capacities passed to createPublishedWithInventory, so tests can assert the inventory write. */
  public inventoryWrites: Array<{ eventId: string; capacity: number }> = [];

  constructor(private rows: Event[] = []) {}

  private byStartsAtAsc(rows: Event[]): Event[] {
    return [...rows].sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  }

  async listPublished(): Promise<Event[]> {
    this.reads += 1;
    return this.byStartsAtAsc(this.rows.filter((row) => row.status === "published"));
  }

  async findPublishedById(id: string): Promise<Event | null> {
    this.reads += 1;
    return this.rows.find((row) => row.id === id && row.status === "published") ?? null;
  }

  async listByOrganiser(organiserId: string): Promise<Event[]> {
    this.reads += 1;
    return this.byStartsAtAsc(this.rows.filter((row) => row.createdBy === organiserId));
  }

  async findById(id: string): Promise<Event | null> {
    this.reads += 1;
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findBySlug(slug: string): Promise<Event | null> {
    this.reads += 1;
    return this.rows.find((row) => row.slug === slug) ?? null;
  }

  async list(): Promise<Event[]> {
    this.reads += 1;
    return this.byStartsAtAsc(this.rows);
  }

  async create(data: NewEvent): Promise<Event> {
    const row = makeEvent(data as Partial<Event>);
    this.rows.push(row);
    return row;
  }

  async createPublishedWithInventory(data: NewEvent, capacity: number): Promise<Event> {
    const row = await this.create(data);
    this.inventoryWrites.push({ eventId: row.id, capacity });
    return row;
  }

  async update(id: string, data: Partial<NewEvent>): Promise<Event | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index === -1) {
      return null;
    }
    this.rows[index] = { ...this.rows[index], ...(data as Partial<Event>), updatedAt: new Date() };
    return this.rows[index];
  }
}
