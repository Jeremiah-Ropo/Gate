import { and, eq, lte, sql } from "drizzle-orm";

import { getDb, type DbExecutor } from "core/db/postgres";
import {
  NewStubPaymentRequest,
  StubPaymentRequest,
  stubPaymentRequests,
} from "core/db/postgres/schema/payment-provider.schema";
import {
  IPaymentProvider,
  IPayReservationDTO,
  PaymentProviderResult,
  PaymentProviderStatus,
} from "../entity/ticket-reservation.interface";

const FAILURE_CARD = "4000000000000002";
const SLOW_CARD = "4000000000003220";
const SLOW_PAYMENT_DURATION_MS = 30_000;

// The stub provider owns this table. Keep its persistence adapter private so the
// reservation service can only observe provider state through IPaymentProvider.
class PaymentProviderRepository {
  constructor(private readonly executor?: DbExecutor) {}

  private get db(): DbExecutor {
    return this.executor ?? getDb();
  }

  async create(data: NewStubPaymentRequest): Promise<StubPaymentRequest> {
    const [request] = await this.db.insert(stubPaymentRequests).values(data).returning();
    return request;
  }

  async findByReference(reference: string): Promise<StubPaymentRequest | null> {
    const [request] = await this.db
      .select()
      .from(stubPaymentRequests)
      .where(eq(stubPaymentRequests.reference, reference))
      .limit(1);
    return request ?? null;
  }

  async markSucceededIfDue(reference: string, completedAt: Date): Promise<StubPaymentRequest | null> {
    const [request] = await this.db
      .update(stubPaymentRequests)
      .set({ status: "succeeded", completesAt: null, updatedAt: completedAt })
      .where(
        and(
          eq(stubPaymentRequests.reference, reference),
          eq(stubPaymentRequests.status, "processing"),
          lte(stubPaymentRequests.completesAt, sql`now()`),
        ),
      )
      .returning();
    return request ?? null;
  }
}

const paymentProviderRepository = new PaymentProviderRepository();

export class PaymentProviderConflictError extends Error {
  constructor(reference: string) {
    super(`A payment already exists for reference ${reference}`);
    this.name = "PaymentProviderConflictError";
  }
}

export class PaymentProviderTimeoutError extends Error {
  constructor() {
    super("The payment provider request timed out");
    this.name = "PaymentProviderTimeoutError";
  }
}

export class PaymentProvider implements IPaymentProvider {
  async pay(reference: string, details: IPayReservationDTO, timeoutMs: number): Promise<PaymentProviderResult> {
    if (await paymentProviderRepository.findByReference(reference)) {
      throw new PaymentProviderConflictError(reference);
    }

    if (details.cardNumber === FAILURE_CARD) {
      await this.createPayment({ reference, status: "failed", failureReason: "The payment was declined" });
      return { status: "failed", reason: "The payment was declined" };
    }

    if (details.cardNumber === SLOW_CARD) {
      await this.createPayment({
        reference,
        status: "processing",
        completesAt: new Date(Date.now() + SLOW_PAYMENT_DURATION_MS),
      });

      await this.waitForSlowPayment(timeoutMs);
      await paymentProviderRepository.markSucceededIfDue(reference, new Date());
      return { status: "succeeded" };
    }

    await this.createPayment({ reference, status: "succeeded" });
    return { status: "succeeded" };
  }

  async getStatus(reference: string): Promise<PaymentProviderStatus> {
    const completed = await paymentProviderRepository.markSucceededIfDue(reference, new Date());
    const payment = completed ?? (await paymentProviderRepository.findByReference(reference));
    if (!payment) {
      return null;
    }
    return payment.status;
  }

  private async createPayment(data: {
    reference: string;
    status: "processing" | "succeeded" | "failed";
    failureReason?: string;
    completesAt?: Date;
  }): Promise<void> {
    try {
      await paymentProviderRepository.create(data);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new PaymentProviderConflictError(data.reference);
      }
      throw error;
    }
  }

  private waitForSlowPayment(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const paymentTimer = setTimeout(() => {
        clearTimeout(timeoutTimer);
        resolve();
      }, SLOW_PAYMENT_DURATION_MS);
      const timeoutTimer = setTimeout(() => {
        clearTimeout(paymentTimer);
        reject(new PaymentProviderTimeoutError());
      }, timeoutMs);
    });
  }
}
export default new PaymentProvider();
