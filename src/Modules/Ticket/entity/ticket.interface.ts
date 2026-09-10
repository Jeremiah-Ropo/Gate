import type { DbTransaction } from "core/db/postgres";
import { NewTicket, Ticket } from "./ticket.model";

export interface ITicketService {
  getById(id: string): Promise<Ticket>;
  getByCode(code: string): Promise<Ticket>;
  listMine(ownerId: string): Promise<Ticket[]>;
  voidTicket(id: string): Promise<Ticket>;
}

export interface ITicketRepository {
  withTx(tx: DbTransaction): ITicketRepository;
  create(data: NewTicket): Promise<Ticket>;
  findById(id: string): Promise<Ticket | null>;
  findByCode(code: string): Promise<Ticket | null>;
  listByOwner(ownerId: string): Promise<Ticket[]>;
  countByEvent(eventId: string): Promise<number>;
  listBlockedIdsByEvent(eventId: string): Promise<string[]>;
  update(id: string, data: Partial<NewTicket>): Promise<Ticket | null>;
}
