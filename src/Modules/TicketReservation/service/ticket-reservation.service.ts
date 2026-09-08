import { randomUUID } from "crypto";
import { Service } from "typedi";

import { withTransaction } from "core/db/postgres";
import {
  PAYMENT_RECOVERY_CLAIM_LEASE_SECONDS,
  PAYMENT_PROCESSING_TTL_SECONDS,
  PAYMENT_PROVIDER_TIMEOUT_MS,
  RESERVATION_TTL_SECONDS,
} from "core/global/config";
import { CustomError } from "core/global/errors";
import eventRepository from "Modules/Event/repository/event.repository";
import eventInventoryRepository from "Modules/Event/repository/event-inventory.repository";
import ticketRepository from "Modules/Ticket/repository/ticket.repository";
import userRepository from "Modules/User/repository/user.repository";
import { signTicket, validateHolderName } from "core/global/utils/ticket-signature";
import {
  ICreateReservationDTO,
  IPayReservationDTO,
  IPaymentProvider,
  IReservationResponseDTO,
  ITicketReservationService,
  PaymentRecoveryStatus,
  PaymentProviderResult,
  PaymentProviderStatus,
} from "../entity/ticket-reservation.interface";
import { ReservationPaymentAttempt, TicketReservation } from "../entity/ticket-reservation.model";
import paymentAttemptRepository from "../repository/ticket-reservation-payment.repository";
import ticketReservationRepository from "../repository/ticket-reservation.repository";
import { PaymentProviderConflictError, PaymentProviderTimeoutError } from "./payment-provider";
import paymentProvider from "./payment-provider";

@Service()
class TicketReservationService implements ITicketReservationService {
  private static instance: ITicketReservationService;
  private readonly reservations = ticketReservationRepository;
  private readonly paymentAttempts = paymentAttemptRepository;
  private readonly inventories = eventInventoryRepository;
  private readonly events = eventRepository;
  private readonly tickets = ticketRepository;
  private readonly users = userRepository;
  private readonly paymentProvider: IPaymentProvider = paymentProvider;

  public static getInstance(): ITicketReservationService {
    if (!this.instance) {
      this.instance = new TicketReservationService();
    }
    return this.instance;
  }

  async create(userId: string, payload: ICreateReservationDTO): Promise<IReservationResponseDTO> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_SECONDS * 1000);
    const eventId = payload.eventId;

    return withTransaction(async (tx) => {
      const events = this.events.withTx(tx);
      const inventories = this.inventories.withTx(tx);
      const reservations = this.reservations.withTx(tx);

      const event = await events.findById(eventId);
      if (!event) {
        throw new CustomError(404, "NotFound", "Event not found");
      }

      if (event.status !== "published") {
        throw new CustomError(409, "Conflict", "Tickets can only be reserved for a published event");
      }

      const reserved = await inventories.reserveTicket(eventId);
      if (!reserved) {
        throw new CustomError(409, "Conflict", "No tickets are available for this event");
      }

      const reservation = await reservations.create({
        userId,
        eventId,
        expiresAt,
      });

      return this.toResponse(reservation);
    });
  }

  async expireOverdueBatch(limit: number, maxEvents: number): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(maxEvents) || maxEvents < 1) {
      throw new Error("Reservation expiry limits must be positive integers");
    }

    return withTransaction(async (tx) => {
      const reservations = this.reservations.withTx(tx);
      const inventories = this.inventories.withTx(tx);
      const expired = await reservations.expireOverduePending(limit, maxEvents);

      if (expired.length === 0) return 0;
      const releases = new Map<string, number>();

      for (const reservation of expired) {
        releases.set(reservation.eventId, (releases.get(reservation.eventId) ?? 0) + 1);
      }

      for (const [eventId, quantity] of releases) {
        const inventory = await inventories.releaseReservedTickets(eventId, quantity);
        if (!inventory) {
          throw new CustomError(409, "Conflict", "Reservation inventory is inconsistent");
        }
      }

      return expired.length;
    });
  }

  async recoverOneStalePayment(): Promise<PaymentRecoveryStatus> {
    const claimId = randomUUID();
    const claimedUntil = new Date(Date.now() + PAYMENT_RECOVERY_CLAIM_LEASE_SECONDS * 1000);
    const claimed = await withTransaction((tx) =>
      this.paymentAttempts.withTx(tx).claimStaleProcessing(claimId, claimedUntil),
    );

    if (!claimed) return "none";

    const status = await this.paymentProvider.getStatus(claimed.reference);

    if (status === null) {
      await this.restoreAfterPaymentFailure(claimed.userId, claimed.reservationId, claimed.id);
      return "failed";
    }

    if (status === "succeeded") {
      await this.claimPaidReservation(claimed.userId, claimed.reservationId, claimed.id);
      return "succeeded";
    }

    if (status === "failed") {
      await this.restoreAfterPaymentFailure(claimed.userId, claimed.reservationId, claimed.id);
      return "failed";
    }

    return status;
  }

  async getById(userId: string, reservationId: string): Promise<IReservationResponseDTO> {
    const current = await this.reservations.findByIdForUser(reservationId, userId);
    if (!current) {
      throw new CustomError(404, "NotFound", "Reservation not found");
    }

    if (current.reservation.status === "payment_processing" && current.latestPayment) {
      return this.reconcilePayment(userId, reservationId, current.latestPayment.id, current.latestPayment.reference);
    }

    return this.toResponse(current.reservation, current.latestPayment, current.ticket?.id ?? null);
  }

  async cancel(userId: string, reservationId: string): Promise<IReservationResponseDTO> {
    return withTransaction(async (tx) => {
      const reservations = this.reservations.withTx(tx);
      const inventories = this.inventories.withTx(tx);
      const current = await reservations.findByIdForUser(reservationId, userId);

      if (!current) {
        throw new CustomError(404, "NotFound", "Reservation not found");
      }

      if (current.reservation.status !== "pending") {
        throw new CustomError(409, "Conflict", "Only a pending reservation can be cancelled");
      }

      const cancelled = await reservations.cancelPending(reservationId, userId, new Date());
      if (!cancelled) {
        throw new CustomError(409, "Conflict", "Reservation state changed; please refresh and try again");
      }

      const released = await inventories.releaseReservedTicket(cancelled.eventId);
      if (!released) {
        throw new CustomError(409, "Conflict", "Reservation inventory is already released");
      }

      return this.toResponse(cancelled, current.latestPayment, current.ticket?.id ?? null);
    });
  }

  async pay(userId: string, reservationId: string, payload: IPayReservationDTO): Promise<IReservationResponseDTO> {
    const current = await this.reservations.findByIdForUser(reservationId, userId);
    if (!current) {
      throw new CustomError(404, "NotFound", "Reservation not found");
    }

    switch (current.reservation.status) {
      case "paid":
        return this.toResponse(current.reservation, current.latestPayment, current.ticket?.id ?? null);
      case "payment_processing": {
        return this.getById(userId, reservationId);
      }
      case "pending":
        break;
      case "expired":
      case "cancelled":
        throw new CustomError(409, "Conflict", "Only a pending reservation can be paid");
    }

    if (current.reservation.expiresAt <= new Date()) {
      throw new CustomError(409, "Conflict", "Reservation has expired; please refresh and try again");
    }

    const owner = await this.users.findById(userId);
    if (!owner) {
      throw new CustomError(404, "NotFound", "Ticket owner not found");
    }
    const holderName = validateHolderName(`${owner.firstName} ${owner.lastName}`);

    const payment = await this.startPayment(userId, reservationId, holderName);
    if (!payment) {
      const latest = await this.getById(userId, reservationId);
      if (latest.status === "payment_processing" || latest.status === "paid") {
        return latest;
      }
      throw new CustomError(409, "Conflict", "Reservation state changed; please refresh and try again");
    }

    let result: PaymentProviderResult;
    try {
      result = await this.paymentProvider.pay(payment.reference, payload, PAYMENT_PROVIDER_TIMEOUT_MS);
    } catch (error) {
      if (!(error instanceof PaymentProviderTimeoutError) && !(error instanceof PaymentProviderConflictError)) {
        throw new CustomError(502, "BadGateway", "The payment provider could not process the payment");
      }

      return this.reconcilePayment(userId, reservationId, payment.id, payment.reference);
    }

    return this.handlePaymentResult(userId, reservationId, payment.id, result);
  }

  private async startPayment(userId: string, reservationId: string, holderName: string) {
    const paymentAttemptId = randomUUID();
    const reference = `reservation-payment-${randomUUID()}`;
    const processingExpiresAt = new Date(Date.now() + PAYMENT_PROCESSING_TTL_SECONDS * 1000);

    return withTransaction(async (tx) => {
      const reservations = this.reservations.withTx(tx);
      const paymentAttempts = this.paymentAttempts.withTx(tx);

      const reservation = await reservations.markPaymentProcessing(
        reservationId,
        userId,
        paymentAttemptId,
        processingExpiresAt,
        new Date(),
      );
      if (!reservation) {
        return null;
      }

      const payment = await paymentAttempts.createProcessing({
        id: paymentAttemptId,
        reservationId,
        reference,
        holderName,
      });

      return { id: payment.id, reference: payment.reference };
    });
  }

  private async handlePaymentResult(
    userId: string,
    reservationId: string,
    paymentAttemptId: string,
    result: PaymentProviderResult,
  ): Promise<IReservationResponseDTO> {
    if (result.status === "succeeded") {
      return this.claimPaidReservation(userId, reservationId, paymentAttemptId);
    }

    await this.restoreAfterPaymentFailure(userId, reservationId, paymentAttemptId);
    throw new CustomError(402, "BadRequest", result.reason);
  }

  private async reconcilePayment(
    userId: string,
    reservationId: string,
    paymentAttemptId: string,
    reference: string,
  ): Promise<IReservationResponseDTO> {
    let status: PaymentProviderStatus;
    try {
      status = await this.paymentProvider.getStatus(reference);
    } catch (_error) {
      throw new CustomError(502, "BadGateway", "The payment provider status could not be reconciled");
    }

    if (status === "succeeded") {
      return this.claimPaidReservation(userId, reservationId, paymentAttemptId);
    }

    if (status === null) {
      await this.restoreAfterPaymentFailure(userId, reservationId, paymentAttemptId);
      throw new CustomError(402, "BadRequest", "The payment was not found by the provider");
    }

    if (status === "failed") {
      await this.restoreAfterPaymentFailure(userId, reservationId, paymentAttemptId);
      throw new CustomError(402, "BadRequest", "The payment was declined");
    }

    const current = await this.reservations.findByIdForUser(reservationId, userId);
    if (!current) {
      throw new CustomError(404, "NotFound", "Reservation not found");
    }
    return this.toResponse(current.reservation, current.latestPayment, current.ticket?.id ?? null);
  }

  private async claimPaidReservation(
    userId: string,
    reservationId: string,
    paymentAttemptId: string,
  ): Promise<IReservationResponseDTO> {
    return withTransaction(async (tx) => {
      const reservations = this.reservations.withTx(tx);
      const paymentAttempts = this.paymentAttempts.withTx(tx);
      const inventories = this.inventories.withTx(tx);
      const tickets = this.tickets.withTx(tx);

      const payment = await paymentAttempts.markSucceeded(paymentAttemptId, new Date());
      if (!payment) {
        const current = await reservations.findByIdForUser(reservationId, userId);
        if (current?.reservation.status === "paid") {
          return this.toResponse(current.reservation, current.latestPayment, current.ticket?.id ?? null);
        }
        throw new CustomError(409, "Conflict", "Payment state changed; please refresh and try again");
      }

      const reservation = await reservations.markPaid(reservationId, userId, paymentAttemptId, new Date());
      if (!reservation) {
        throw new CustomError(409, "Conflict", "Reservation state changed; please refresh and try again");
      }

      const inventory = await inventories.sellReservedTicket(reservation.eventId);
      if (!inventory) {
        throw new CustomError(409, "Conflict", "Reservation inventory is unavailable; please refresh and try again");
      }

      const ticketId = randomUUID();
      const ticket = await tickets.create({
        id: ticketId,
        eventId: reservation.eventId,
        reservationId: reservation.id,
        ownerId: userId,
        qrPayload: signTicket(ticketId, reservation.eventId, payment.holderName),
      });

      return this.toResponse(reservation, payment, ticket.id);
    });
  }

  private async restoreAfterPaymentFailure(
    userId: string,
    reservationId: string,
    paymentAttemptId: string,
  ): Promise<void> {
    await withTransaction(async (tx) => {
      const reservations = this.reservations.withTx(tx);
      const paymentAttempts = this.paymentAttempts.withTx(tx);
      const now = new Date();

      const payment = await paymentAttempts.markFailed(paymentAttemptId, now);
      if (!payment) {
        const current = await reservations.findByIdForUser(reservationId, userId);
        if (current?.reservation.status === "pending") {
          return;
        }
        throw new CustomError(409, "Conflict", "Payment state changed; please refresh and try again");
      }

      const reservation = await reservations.markPaymentPending(reservationId, userId, paymentAttemptId, now);
      if (!reservation) {
        throw new CustomError(409, "Conflict", "Reservation state changed; please refresh and try again");
      }
    });
  }

  private toResponse(
    reservation: TicketReservation,
    latestPayment: ReservationPaymentAttempt | null = null,
    ticketId: string | null = null,
  ): IReservationResponseDTO {
    return {
      id: reservation.id,
      eventId: reservation.eventId,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      paymentProcessingExpiresAt: reservation.paymentProcessingExpiresAt?.toISOString() ?? null,
      lastPayment: latestPayment
        ? {
            status: latestPayment.status,
            attemptedAt: latestPayment.createdAt.toISOString(),
            updatedAt: latestPayment.updatedAt.toISOString(),
          }
        : null,
      ticketId,
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
    };
  }
}

export default TicketReservationService.getInstance();
