import { and, desc, eq } from "drizzle-orm";

import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { EMembershipStatus } from "core/global/entities/enums";
import { EventTable } from "Modules/Event/entity/event.model";
import { UserTable } from "Modules/User/entity/user.model";
import { toPublicUser } from "Modules/User/entity/user.view";
import { IEventMemberRepository, IMyEventRow } from "../entity/event-member.interface";
import { EventMember, EventMemberTable, NewEventMember } from "../entity/event-member.model";
import { EventMemberWithUser } from "../entity/event-member.view";

class EventMemberRepository implements IEventMemberRepository {
  private static instance: IEventMemberRepository;

  constructor(private readonly executor?: DbExecutor) {}

  public static getInstance(): IEventMemberRepository {
    if (!this.instance) {
      this.instance = new EventMemberRepository();
    }
    return this.instance;
  }

  withTx(tx: DbTransaction): IEventMemberRepository {
    return new EventMemberRepository(tx);
  }

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async create(data: NewEventMember): Promise<EventMember> {
    const [member] = await this.db.insert(EventMemberTable).values(data).returning();
    return member;
  }

  async findById(id: string): Promise<EventMember | null> {
    const [member] = await this.db.select().from(EventMemberTable).where(eq(EventMemberTable.id, id)).limit(1);
    return member ?? null;
  }

  async findByEventAndUser(eventId: string, userId: string): Promise<EventMember | null> {
    const [member] = await this.db
      .select()
      .from(EventMemberTable)
      .where(and(eq(EventMemberTable.eventId, eventId), eq(EventMemberTable.userId, userId)))
      .limit(1);
    return member ?? null;
  }

  async listByEvent(eventId: string): Promise<EventMember[]> {
    return this.db
      .select()
      .from(EventMemberTable)
      .where(eq(EventMemberTable.eventId, eventId))
      .orderBy(desc(EventMemberTable.createdAt));
  }

  async listByEventWithUsers(eventId: string): Promise<EventMemberWithUser[]> {
    const rows = await this.db
      .select({
        id: EventMemberTable.id,
        eventId: EventMemberTable.eventId,
        userId: EventMemberTable.userId,
        role: EventMemberTable.role,
        status: EventMemberTable.status,
        createdAt: EventMemberTable.createdAt,
        updatedAt: EventMemberTable.updatedAt,
        user: UserTable,
      })
      .from(EventMemberTable)
      .innerJoin(UserTable, eq(UserTable.id, EventMemberTable.userId))
      .where(eq(EventMemberTable.eventId, eventId))
      .orderBy(desc(EventMemberTable.createdAt));

    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: toPublicUser(row.user),
    }));
  }

  // Joined rather than returning bare memberships: a door staff member picking an event
  // needs its name and start time, and a second round trip per event to get them would be
  // the classic N+1.
  async listActiveEventsForUser(userId: string): Promise<IMyEventRow[]> {
    return this.db
      .select({
        eventId: EventTable.id,
        eventName: EventTable.name,
        startsAt: EventTable.starts_at,
        venue: EventTable.venue,
        role: EventMemberTable.role,
        status: EventMemberTable.status,
      })
      .from(EventMemberTable)
      .innerJoin(EventTable, eq(EventTable.id, EventMemberTable.eventId))
      .where(and(eq(EventMemberTable.userId, userId), eq(EventMemberTable.status, EMembershipStatus.ACTIVE)))
      .orderBy(desc(EventTable.starts_at));
  }

  async update(id: string, data: Partial<NewEventMember>): Promise<EventMember | null> {
    const [member] = await this.db
      .update(EventMemberTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(EventMemberTable.id, id))
      .returning();
    return member ?? null;
  }
}

export default EventMemberRepository.getInstance();
