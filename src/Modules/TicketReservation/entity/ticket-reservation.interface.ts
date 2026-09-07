import type { DbTransaction } from "core/db/postgres";
import { NewTicketReservation, TicketReservation } from "./ticket-reservation.model";

export type ReservationStatus = "pending" | "paid" | "expired" | "cancelled";

export interface ICreateReservationDTO {
  eventId: string;
}

export interface IReservationResponseDTO {
  id: string;
  eventId: string;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITicketReservationRepository {
  withTx(tx: DbTransaction): ITicketReservationRepository;
  create(data: NewTicketReservation): Promise<TicketReservation>;
  findById(id: string): Promise<TicketReservation | null>;
  findByIdForUser(id: string, userId: string): Promise<TicketReservation | null>;
  cancelPending(id: string, userId: string, cancelledAt: Date): Promise<TicketReservation | null>;
}

export interface ITicketReservationService {
  create(userId: string, payload: ICreateReservationDTO): Promise<IReservationResponseDTO>;
  getById(userId: string, reservationId: string): Promise<IReservationResponseDTO>;
  cancel(userId: string, reservationId: string): Promise<IReservationResponseDTO>;
}
