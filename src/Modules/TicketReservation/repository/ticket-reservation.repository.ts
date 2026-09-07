import { and, eq } from "drizzle-orm";

import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { ITicketReservationRepository } from "../entity/ticket-reservation.interface";
import { TicketReservation, TicketReservationTable, NewTicketReservation } from "../entity/ticket-reservation.model";

class TicketReservationRepository implements ITicketReservationRepository {
  private static instance: ITicketReservationRepository;

  constructor(private readonly executor?: DbExecutor) {}

  public static getInstance(): ITicketReservationRepository {
    if (!this.instance) {
      this.instance = new TicketReservationRepository();
    }
    return this.instance;
  }

  withTx(tx: DbTransaction): ITicketReservationRepository {
    return new TicketReservationRepository(tx);
  }

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async create(data: NewTicketReservation): Promise<TicketReservation> {
    const [reservation] = await this.db.insert(TicketReservationTable).values(data).returning();
    return reservation;
  }

  async findById(id: string): Promise<TicketReservation | null> {
    const [reservation] = await this.db
      .select()
      .from(TicketReservationTable)
      .where(eq(TicketReservationTable.id, id))
      .limit(1);
    return reservation ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<TicketReservation | null> {
    const [reservation] = await this.db
      .select()
      .from(TicketReservationTable)
      .where(and(eq(TicketReservationTable.id, id), eq(TicketReservationTable.userId, userId)))
      .limit(1);
    return reservation ?? null;
  }

  async cancelPending(id: string, userId: string, now: Date): Promise<TicketReservation | null> {
    const [reservation] = await this.db
      .update(TicketReservationTable)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(TicketReservationTable.id, id),
          eq(TicketReservationTable.userId, userId),
          eq(TicketReservationTable.status, "pending"),
        ),
      )
      .returning();
    return reservation ?? null;
  }
}

export default TicketReservationRepository.getInstance();
