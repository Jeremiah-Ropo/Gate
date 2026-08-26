import { desc, eq } from "drizzle-orm";

import { getDb } from "core/db/postgres";
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

  async findById(id: string): Promise<Event | null> {
    const [event] = await getDb().select().from(EventTable).where(eq(EventTable.id, id)).limit(1);
    return event ?? null;
  }

  async findBySlug(slug: string): Promise<Event | null> {
    const [event] = await getDb().select().from(EventTable).where(eq(EventTable.slug, slug)).limit(1);
    return event ?? null;
  }

  async list(): Promise<Event[]> {
    return getDb().select().from(EventTable).orderBy(desc(EventTable.startDate));
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
