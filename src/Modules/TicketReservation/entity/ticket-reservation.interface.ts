import type { DbTransaction } from "core/db/postgres";
import type {
  NewReservationPaymentAttempt,
  NewTicketReservation,
  ReservationPaymentAttempt,
  TicketReservation,
} from "./ticket-reservation.model";
import type { Ticket } from "Modules/Ticket/entity/ticket.model";

export type ReservationStatus = "pending" | "payment_processing" | "paid" | "expired" | "cancelled";
export type PaymentAttemptStatus = "processing" | "succeeded" | "failed";

export interface IPayReservationDTO {
  cardNumber: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
}

export type PaymentProviderResult = { status: "succeeded" } | { status: "failed"; reason: string };
export type PaymentProviderStatus = "processing" | "succeeded" | "failed" | "unknown";

export interface IPaymentProvider {
  pay(reference: string, details: IPayReservationDTO, timeoutMs: number): Promise<PaymentProviderResult>;
  getStatus(reference: string): Promise<PaymentProviderStatus>;
}

export interface ILastPaymentDTO {
  status: PaymentAttemptStatus;
  attemptedAt: string;
  updatedAt: string;
}

export interface ICreateReservationDTO {
  eventId: string;
}

export interface IReservationResponseDTO {
  id: string;
  eventId: string;
  status: ReservationStatus;
  expiresAt: string;
  paymentProcessingExpiresAt: string | null;
  lastPayment: ILastPaymentDTO | null;
  ticketId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketReservationWithDetails {
  reservation: TicketReservation;
  latestPayment: ReservationPaymentAttempt | null;
  ticket: Ticket | null;
}

export interface ITicketReservationRepository {
  withTx(tx: DbTransaction): ITicketReservationRepository;
  create(data: NewTicketReservation): Promise<TicketReservation>;
  findById(id: string): Promise<TicketReservationWithDetails | null>;
  findByIdForUser(id: string, userId: string): Promise<TicketReservationWithDetails | null>;
  findUnexpiredPendingByIdForUser(id: string, userId: string): Promise<TicketReservationWithDetails | null>;
  cancelPending(id: string, userId: string, cancelledAt: Date): Promise<TicketReservation | null>;
  markPaymentProcessing(
    id: string,
    userId: string,
    paymentAttemptId: string,
    processingExpiresAt: Date,
    updatedAt: Date,
  ): Promise<TicketReservation | null>;
  markPaid(id: string, userId: string, paymentAttemptId: string, paidAt: Date): Promise<TicketReservation | null>;
  markPaymentPending(
    id: string,
    userId: string,
    paymentAttemptId: string,
    updatedAt: Date,
  ): Promise<TicketReservation | null>;
}

export interface ITicketReservationPaymentRepository {
  withTx(tx: DbTransaction): ITicketReservationPaymentRepository;
  createProcessing(data: NewReservationPaymentAttempt): Promise<ReservationPaymentAttempt>;
  findById(id: string): Promise<ReservationPaymentAttempt | null>;
  findByReference(reference: string): Promise<ReservationPaymentAttempt | null>;
  markSucceeded(id: string, completedAt: Date): Promise<ReservationPaymentAttempt | null>;
  markFailed(id: string, failedAt: Date): Promise<ReservationPaymentAttempt | null>;
}

export interface ITicketReservationService {
  create(userId: string, payload: ICreateReservationDTO): Promise<IReservationResponseDTO>;
  getById(userId: string, reservationId: string): Promise<IReservationResponseDTO>;
  cancel(userId: string, reservationId: string): Promise<IReservationResponseDTO>;
  pay(userId: string, reservationId: string, payload: IPayReservationDTO): Promise<IReservationResponseDTO>;
}
