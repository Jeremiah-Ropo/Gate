import { count, desc, eq } from "drizzle-orm";

import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { ITicketRepository } from "../entity/ticket.interface";
import { NewTicket, Ticket, TicketTable } from "../entity/ticket.model";

class TicketRepository implements ITicketRepository {
  private static instance: ITicketRepository;

  constructor(private readonly executor?: DbExecutor) {}

  public static getInstance(): ITicketRepository {
    if (!this.instance) {
      this.instance = new TicketRepository();
    }
    return this.instance;
  }

  withTx(tx: DbTransaction): ITicketRepository {
    return new TicketRepository(tx);
  }

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async create(data: NewTicket): Promise<Ticket> {
    const [ticket] = await this.db.insert(TicketTable).values(data).returning();
    return ticket;
  }

  async findById(id: string): Promise<Ticket | null> {
    const [ticket] = await this.db.select().from(TicketTable).where(eq(TicketTable.id, id)).limit(1);
    return ticket ?? null;
  }

  async findByCode(code: string): Promise<Ticket | null> {
    const [ticket] = await this.db.select().from(TicketTable).where(eq(TicketTable.qrPayload, code)).limit(1);
    return ticket ?? null;
  }

  async listByOwner(ownerId: string): Promise<Ticket[]> {
    return this.db
      .select()
      .from(TicketTable)
      .where(eq(TicketTable.ownerId, ownerId))
      .orderBy(desc(TicketTable.issuedAt));
  }

  async countByEvent(eventId: string): Promise<number> {
    const [result] = await this.db.select({ value: count() }).from(TicketTable).where(eq(TicketTable.eventId, eventId));
    return Number(result?.value ?? 0);
  }

  async update(id: string, data: Partial<NewTicket>): Promise<Ticket | null> {
    const [ticket] = await this.db
      .update(TicketTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(TicketTable.id, id))
      .returning();
    return ticket ?? null;
  }
}

export default TicketRepository.getInstance();
