import { and, asc, eq } from "drizzle-orm";

import { EEventStatus } from "core/global/entities/enums";
import { getDb } from "core/db/postgres";
import { eventInventory } from "core/db/postgres/schema";
import { EventTable, Event, NewEvent } from "../entity/event.model";
import { IEventRepository } from "../entity/event.interface";

class EventRepository implements IEventRepository {
  private static instance: IEventRepository;

  public static getInstance(): IEventRepository {
    if (!this.instance) {
      this.instance = new EventRepository();
    }
    return this.instance;
  }

  async create(data: NewEvent): Promise<Event> {
    const [event] = await getDb().insert(EventTable).values(data).returning();
    return event;
  }

  /**
   * The only place this slice writes events_inventory. Inventory's schema requires the row to exist
   * from the moment the event does, so both inserts share one transaction: an event that committed
   * without its inventory row could never be claimed and would need manual repair.
   *
   * If Inventory would rather own this write, replacing the second insert with a call into their
   * service is the whole change.
   */
  async createPublishedWithInventory(data: NewEvent, capacity: number): Promise<Event> {
    return getDb().transaction(async (tx) => {
      const [event] = await tx.insert(EventTable).values(data).returning();
      await tx.insert(eventInventory).values({ eventId: event.id, capacity });
      return event;
    });
  }

  async findById(id: string): Promise<Event | null> {
    const [event] = await getDb().select().from(EventTable).where(eq(EventTable.id, id)).limit(1);
    return event ?? null;
  }

  async findBySlug(slug: string): Promise<Event | null> {
    const [event] = await getDb().select().from(EventTable).where(eq(EventTable.slug, slug)).limit(1);
    return event ?? null;
  }

  async list(): Promise<Event[]> {
    return getDb().select().from(EventTable).orderBy(asc(EventTable.starts_at));
  }

  /** Public catalogue: published events only, soonest first, served by events_status_starts_at_idx. */
  async listPublished(): Promise<Event[]> {
    return getDb()
      .select()
      .from(EventTable)
      .where(eq(EventTable.status, EEventStatus.PUBLISHED))
      .orderBy(asc(EventTable.starts_at));
  }

  /** Status is part of the predicate so an unpublished event is indistinguishable from a missing one. */
  async findPublishedById(id: string): Promise<Event | null> {
    const [event] = await getDb()
      .select()
      .from(EventTable)
      .where(and(eq(EventTable.id, id), eq(EventTable.status, EEventStatus.PUBLISHED)))
      .limit(1);
    return event ?? null;
  }

  /** Console listing: every event this organiser owns, drafts included. */
  async listByOrganiser(organiserId: string): Promise<Event[]> {
    return getDb()
      .select()
      .from(EventTable)
      .where(eq(EventTable.createdBy, organiserId))
      .orderBy(asc(EventTable.starts_at));
  }

  async update(id: string, data: Partial<NewEvent>): Promise<Event | null> {
    const [event] = await getDb()
      .update(EventTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(EventTable.id, id))
      .returning();
    return event ?? null;
  }
}

export default EventRepository.getInstance();
