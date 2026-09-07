import { and, eq, gt, sql } from "drizzle-orm";

import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { ITicketReservationRepository, TicketReservationWithDetails } from "../entity/ticket-reservation.interface";
import { TicketTable } from "Modules/Ticket/entity/ticket.model";
import {
  NewTicketReservation,
  ReservationPaymentAttemptTable,
  TicketReservation,
  TicketReservationTable,
} from "../entity/ticket-reservation.model";

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

  async findById(id: string): Promise<TicketReservationWithDetails | null> {
    const [result] = await this.db
      .select({
        reservation: TicketReservationTable,
        latestPayment: ReservationPaymentAttemptTable,
        ticket: TicketTable,
      })
      .from(TicketReservationTable)
      .leftJoin(
        ReservationPaymentAttemptTable,
        eq(TicketReservationTable.latestPaymentId, ReservationPaymentAttemptTable.id),
      )
      .leftJoin(TicketTable, eq(TicketTable.reservationId, TicketReservationTable.id))
      .where(eq(TicketReservationTable.id, id))
      .limit(1);
    return result ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<TicketReservationWithDetails | null> {
    const [reservation] = await this.db
      .select({
        reservation: TicketReservationTable,
        latestPayment: ReservationPaymentAttemptTable,
        ticket: TicketTable,
      })
      .from(TicketReservationTable)
      .leftJoin(
        ReservationPaymentAttemptTable,
        eq(TicketReservationTable.latestPaymentId, ReservationPaymentAttemptTable.id),
      )
      .leftJoin(TicketTable, eq(TicketTable.reservationId, TicketReservationTable.id))
      .where(and(eq(TicketReservationTable.id, id), eq(TicketReservationTable.userId, userId)))
      .limit(1);
    return reservation ?? null;
  }

  async findUnexpiredPendingByIdForUser(id: string, userId: string): Promise<TicketReservationWithDetails | null> {
    const [reservation] = await this.db
      .select({
        reservation: TicketReservationTable,
        latestPayment: ReservationPaymentAttemptTable,
        ticket: TicketTable,
      })
      .from(TicketReservationTable)
      .leftJoin(
        ReservationPaymentAttemptTable,
        eq(TicketReservationTable.latestPaymentId, ReservationPaymentAttemptTable.id),
      )
      .leftJoin(TicketTable, eq(TicketTable.reservationId, TicketReservationTable.id))
      .where(
        and(
          eq(TicketReservationTable.id, id),
          eq(TicketReservationTable.userId, userId),
          eq(TicketReservationTable.status, "pending"),
          gt(TicketReservationTable.expiresAt, sql`now()`),
        ),
      )
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

  async markPaymentProcessing(
    id: string,
    userId: string,
    paymentAttemptId: string,
    processingExpiresAt: Date,
    updatedAt: Date,
  ): Promise<TicketReservation | null> {
    const [reservation] = await this.db
      .update(TicketReservationTable)
      .set({
        status: "payment_processing",
        latestPaymentId: paymentAttemptId,
        paymentProcessingExpiresAt: processingExpiresAt,
        updatedAt,
      })
      .where(
        and(
          eq(TicketReservationTable.id, id),
          eq(TicketReservationTable.userId, userId),
          eq(TicketReservationTable.status, "pending"),
          gt(TicketReservationTable.expiresAt, sql`now()`),
        ),
      )
      .returning();
    return reservation ?? null;
  }

  async markPaid(
    id: string,
    userId: string,
    paymentAttemptId: string,
    paidAt: Date,
  ): Promise<TicketReservation | null> {
    const [reservation] = await this.db
      .update(TicketReservationTable)
      .set({ status: "paid", paidAt, paymentProcessingExpiresAt: null, updatedAt: paidAt })
      .where(
        and(
          eq(TicketReservationTable.id, id),
          eq(TicketReservationTable.userId, userId),
          eq(TicketReservationTable.status, "payment_processing"),
          eq(TicketReservationTable.latestPaymentId, paymentAttemptId),
        ),
      )
      .returning();
    return reservation ?? null;
  }

  async markPaymentPending(
    id: string,
    userId: string,
    paymentAttemptId: string,
    updatedAt: Date,
  ): Promise<TicketReservation | null> {
    const [reservation] = await this.db
      .update(TicketReservationTable)
      .set({ status: "pending", paymentProcessingExpiresAt: null, updatedAt })
      .where(
        and(
          eq(TicketReservationTable.id, id),
          eq(TicketReservationTable.userId, userId),
          eq(TicketReservationTable.status, "payment_processing"),
          eq(TicketReservationTable.latestPaymentId, paymentAttemptId),
        ),
      )
      .returning();
    return reservation ?? null;
  }
}

export default TicketReservationRepository.getInstance();
