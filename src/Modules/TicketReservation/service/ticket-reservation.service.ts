import { Service } from "typedi";

import { withTransaction } from "core/db/postgres";
import { RESERVATION_TTL_SECONDS } from "core/global/config";
import { CustomError } from "core/global/errors";
import eventRepository from "Modules/Event/repository/event.repository";
import eventInventoryRepository from "Modules/Event/repository/event-inventory.repository";
import { ITicketReservationService } from "../entity/ticket-reservation.interface";
import { TicketReservation } from "../entity/ticket-reservation.model";
import ticketReservationRepository from "../repository/ticket-reservation.repository";

@Service()
class TicketReservationService implements ITicketReservationService {
  private static instance: ITicketReservationService;
  private readonly reservations = ticketReservationRepository;
  private readonly inventories = eventInventoryRepository;
  private readonly events = eventRepository;

  public static getInstance(): ITicketReservationService {
    if (!this.instance) {
      this.instance = new TicketReservationService();
    }
    return this.instance;
  }

  async create(userId: string, eventId: string): Promise<TicketReservation> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_SECONDS * 1000);

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

      return reservations.create({
        userId,
        eventId,
        expiresAt,
      });
    });
  }

  async cancel(userId: string, reservationId: string): Promise<TicketReservation> {
    return withTransaction(async (tx) => {
      const reservations = this.reservations.withTx(tx);
      const inventories = this.inventories.withTx(tx);
      const current = await reservations.findByIdForUser(reservationId, userId);

      if (!current) {
        throw new CustomError(404, "NotFound", "Reservation not found");
      }

      if (current.status !== "pending") {
        throw new CustomError(409, "Conflict", "Only a pending reservation can be cancelled");
      }

      const now = new Date();
      const cancelled = await reservations.cancelPending(reservationId, userId, now);
      if (!cancelled) {
        throw new CustomError(409, "Conflict", "Reservation state changed; please refresh and try again");
      }

      const released = await inventories.releaseReservedTicket(cancelled.eventId);
      if (!released) {
        throw new CustomError(409, "Conflict", "Reservation inventory is already released");
      }

      return cancelled;
    });
  }
}

export default TicketReservationService.getInstance();
