import type { DbTransaction } from "core/db/postgres";
import { NewTicketReservation, TicketReservation } from "./ticket-reservation.model";

export interface ITicketReservationRepository {
  withTx(tx: DbTransaction): ITicketReservationRepository;
  create(data: NewTicketReservation): Promise<TicketReservation>;
  findById(id: string): Promise<TicketReservation | null>;
  findByIdForUser(id: string, userId: string): Promise<TicketReservation | null>;
  cancelPending(id: string, userId: string, cancelledAt: Date): Promise<TicketReservation | null>;
}

export interface ITicketReservationService {
  create(userId: string, eventId: string): Promise<TicketReservation>;
  getById(userId: string, reservationId: string): Promise<TicketReservation>;
  cancel(userId: string, reservationId: string): Promise<TicketReservation>;
}
