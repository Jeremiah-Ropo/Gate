import {
  IPaymentProvider,
  IPayReservationDTO,
  PaymentProviderResult,
  PaymentProviderStatus,
} from "../entity/ticket-reservation.interface";

const FAILURE_CARD = "4000000000000002";
const SLOW_CARD = "4000000000003220";
const SLOW_PAYMENT_DURATION_MS = 30_000;

type StoredPayment = {
  status: PaymentProviderStatus;
  completesAt?: number;
};

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

class PaymentProvider implements IPaymentProvider {
  private readonly payments = new Map<string, StoredPayment>();

  async pay(reference: string, details: IPayReservationDTO, timeoutMs: number): Promise<PaymentProviderResult> {
    if (this.payments.has(reference)) {
      throw new PaymentProviderConflictError(reference);
    }

    if (details.cardNumber === FAILURE_CARD) {
      this.payments.set(reference, { status: "failed" });
      return { status: "failed", reason: "The payment was declined" };
    }

    if (details.cardNumber === SLOW_CARD) {
      this.payments.set(reference, {
        status: "processing",
        completesAt: Date.now() + SLOW_PAYMENT_DURATION_MS,
      });

      await this.waitForSlowPayment(timeoutMs);
      this.payments.set(reference, { status: "succeeded" });
      return { status: "succeeded" };
    }

    this.payments.set(reference, { status: "succeeded" });
    return { status: "succeeded" };
  }

  async getStatus(reference: string): Promise<PaymentProviderStatus> {
    const payment = this.payments.get(reference);
    if (!payment) {
      return "unknown";
    }

    if (payment.status === "processing" && payment.completesAt && Date.now() >= payment.completesAt) {
      payment.status = "succeeded";
      delete payment.completesAt;
    }

    return payment.status;
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
