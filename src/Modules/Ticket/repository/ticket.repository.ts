import { count, desc, eq } from "drizzle-orm";

import { getDb } from "core/db/postgres";
import { ITicketRepository } from "../entity/ticket.interface";
import { NewTicket, Ticket, TicketTable } from "../entity/ticket.model";

class TicketRepository implements ITicketRepository {
  private static instance: ITicketRepository;

  public static getInstance(): ITicketRepository {
    if (!this.instance) {
      this.instance = new TicketRepository();
    }
    return this.instance;
  }

  async create(data: NewTicket): Promise<Ticket> {
    const [ticket] = await getDb().insert(TicketTable).values(data).returning();
    return ticket;
  }

  async findById(id: string): Promise<Ticket | null> {
    const [ticket] = await getDb().select().from(TicketTable).where(eq(TicketTable.id, id)).limit(1);
    return ticket ?? null;
  }

  async findByCode(code: string): Promise<Ticket | null> {
    const [ticket] = await getDb().select().from(TicketTable).where(eq(TicketTable.code, code)).limit(1);
    return ticket ?? null;
  }

  async listByOwner(ownerId: string): Promise<Ticket[]> {
    return getDb()
      .select()
      .from(TicketTable)
      .where(eq(TicketTable.ownerId, ownerId))
      .orderBy(desc(TicketTable.issuedAt));
  }

  async countByEvent(eventId: string): Promise<number> {
    const [result] = await getDb().select({ value: count() }).from(TicketTable).where(eq(TicketTable.eventId, eventId));
    return Number(result?.value ?? 0);
  }

  async update(id: string, data: Partial<NewTicket>): Promise<Ticket | null> {
    const [ticket] = await getDb()
      .update(TicketTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(TicketTable.id, id))
      .returning();
    return ticket ?? null;
  }
}

export default TicketRepository.getInstance();
