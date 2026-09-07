import { and, eq } from "drizzle-orm";

import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { ITicketReservationPaymentRepository } from "../entity/ticket-reservation.interface";
import {
  NewReservationPaymentAttempt,
  ReservationPaymentAttempt,
  ReservationPaymentAttemptTable,
} from "../entity/ticket-reservation.model";

class TicketReservationPaymentRepository implements ITicketReservationPaymentRepository {
  private static instance: ITicketReservationPaymentRepository;

  constructor(private readonly executor?: DbExecutor) {}

  public static getInstance(): ITicketReservationPaymentRepository {
    if (!this.instance) {
      this.instance = new TicketReservationPaymentRepository();
    }
    return this.instance;
  }

  withTx(tx: DbTransaction): ITicketReservationPaymentRepository {
    return new TicketReservationPaymentRepository(tx);
  }

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async createProcessing(data: NewReservationPaymentAttempt): Promise<ReservationPaymentAttempt> {
    const [attempt] = await this.db.insert(ReservationPaymentAttemptTable).values(data).returning();
    return attempt;
  }

  async findById(id: string): Promise<ReservationPaymentAttempt | null> {
    const [attempt] = await this.db
      .select()
      .from(ReservationPaymentAttemptTable)
      .where(eq(ReservationPaymentAttemptTable.id, id))
      .limit(1);
    return attempt ?? null;
  }

  async findByReference(reference: string): Promise<ReservationPaymentAttempt | null> {
    const [attempt] = await this.db
      .select()
      .from(ReservationPaymentAttemptTable)
      .where(eq(ReservationPaymentAttemptTable.reference, reference))
      .limit(1);
    return attempt ?? null;
  }

  async markSucceeded(id: string, completedAt: Date): Promise<ReservationPaymentAttempt | null> {
    const [attempt] = await this.db
      .update(ReservationPaymentAttemptTable)
      .set({ status: "succeeded", updatedAt: completedAt })
      .where(and(eq(ReservationPaymentAttemptTable.id, id), eq(ReservationPaymentAttemptTable.status, "processing")))
      .returning();
    return attempt ?? null;
  }

  async markFailed(id: string, failedAt: Date): Promise<ReservationPaymentAttempt | null> {
    const [attempt] = await this.db
      .update(ReservationPaymentAttemptTable)
      .set({ status: "failed", updatedAt: failedAt })
      .where(and(eq(ReservationPaymentAttemptTable.id, id), eq(ReservationPaymentAttemptTable.status, "processing")))
      .returning();
    return attempt ?? null;
  }
}

export default TicketReservationPaymentRepository.getInstance();
