import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import { getDb, type DbExecutor, type DbTransaction } from "core/db/postgres";
import { ITicketReservationPaymentRepository, StalePaymentAttempt } from "../entity/ticket-reservation.interface";
import {
  NewReservationPaymentAttempt,
  ReservationPaymentAttempt,
  ReservationPaymentAttemptTable,
  TicketReservationTable,
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

  async claimStaleProcessing(claimId: string, claimedUntil: Date): Promise<StalePaymentAttempt | null> {
    const staleCandidate = this.db.$with("stale_payment_candidate").as(
      this.db
        .select({
          id: ReservationPaymentAttemptTable.id,
          reservationId: ReservationPaymentAttemptTable.reservationId,
          userId: TicketReservationTable.userId,
          reference: ReservationPaymentAttemptTable.reference,
        })
        .from(ReservationPaymentAttemptTable)
        .innerJoin(
          TicketReservationTable,
          eq(TicketReservationTable.latestPaymentId, ReservationPaymentAttemptTable.id),
        )
        .where(
          and(
            eq(ReservationPaymentAttemptTable.status, "processing"),
            eq(TicketReservationTable.status, "payment_processing"),
            lte(TicketReservationTable.paymentProcessingExpiresAt, sql`now()`),
            or(
              isNull(ReservationPaymentAttemptTable.recoveryClaimedUntil),
              lte(ReservationPaymentAttemptTable.recoveryClaimedUntil, sql`now()`),
            ),
          ),
        )
        .orderBy(asc(ReservationPaymentAttemptTable.createdAt), asc(ReservationPaymentAttemptTable.id))
        .limit(1)
        .for("update", { of: ReservationPaymentAttemptTable, skipLocked: true }),
    );

    const [claimed] = await this.db
      .with(staleCandidate)
      .update(ReservationPaymentAttemptTable)
      .set({ recoveryClaimId: claimId, recoveryClaimedUntil: claimedUntil })
      .from(staleCandidate)
      .where(
        and(
          eq(ReservationPaymentAttemptTable.id, staleCandidate.id),
          eq(ReservationPaymentAttemptTable.status, "processing"),
        ),
      )
      .returning({
        id: ReservationPaymentAttemptTable.id,
        reservationId: ReservationPaymentAttemptTable.reservationId,
        userId: staleCandidate.userId,
        reference: staleCandidate.reference,
      });

    return claimed ?? null;
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
      .set({
        status: "succeeded",
        recoveryClaimId: null,
        recoveryClaimedUntil: null,
        updatedAt: completedAt,
      })
      .where(and(eq(ReservationPaymentAttemptTable.id, id), eq(ReservationPaymentAttemptTable.status, "processing")))
      .returning();
    return attempt ?? null;
  }

  async markFailed(id: string, failedAt: Date): Promise<ReservationPaymentAttempt | null> {
    const [attempt] = await this.db
      .update(ReservationPaymentAttemptTable)
      .set({
        status: "failed",
        recoveryClaimId: null,
        recoveryClaimedUntil: null,
        updatedAt: failedAt,
      })
      .where(and(eq(ReservationPaymentAttemptTable.id, id), eq(ReservationPaymentAttemptTable.status, "processing")))
      .returning();
    return attempt ?? null;
  }
}

export default TicketReservationPaymentRepository.getInstance();
