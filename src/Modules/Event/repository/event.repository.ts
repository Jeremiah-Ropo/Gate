import { desc, eq } from "drizzle-orm";

import { getDb, type DbExecutor } from "core/db/postgres";
import { EventTable, Event, NewEvent } from "../entity/event.model";
import { IEventRepository } from "../entity/event.interface";

class EventRepository implements IEventRepository {
  private static instance: IEventRepository;

  constructor(private readonly executor?: DbExecutor) {}

  public static getInstance(): IEventRepository {
    if (!this.instance) {
      this.instance = new EventRepository();
    }
    return this.instance;
  }

  withExecutor(executor: DbExecutor): IEventRepository {
    return new EventRepository(executor);
  }

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async create(data: NewEvent): Promise<Event> {
    const [event] = await this.db.insert(EventTable).values(data).returning();
    return event;
  }

  async findById(id: string): Promise<Event | null> {
    const [event] = await this.db.select().from(EventTable).where(eq(EventTable.id, id)).limit(1);
    return event ?? null;
  }

  async findBySlug(slug: string): Promise<Event | null> {
    const [event] = await this.db.select().from(EventTable).where(eq(EventTable.slug, slug)).limit(1);
    return event ?? null;
  }

  async list(): Promise<Event[]> {
    return this.db.select().from(EventTable).orderBy(desc(EventTable.starts_at));
  }

  async update(id: string, data: Partial<NewEvent>): Promise<Event | null> {
    const [event] = await this.db
      .update(EventTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(EventTable.id, id))
      .returning();
    return event ?? null;
  }
}

export default EventRepository.getInstance();
