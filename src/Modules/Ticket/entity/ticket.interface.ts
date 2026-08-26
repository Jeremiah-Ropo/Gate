import { NewTicket, Ticket } from "./ticket.model";

export interface IIssueTicketDTO {
  eventId: string;
  ownerName: string;
  ownerEmail: string;
}

export interface ITicketService {
  issueTicket(purchaserId: string, payload: IIssueTicketDTO): Promise<Ticket>;
  getById(id: string): Promise<Ticket>;
  getByCode(code: string): Promise<Ticket>;
  listMine(ownerId: string): Promise<Ticket[]>;
  voidTicket(id: string): Promise<Ticket>;
}

export interface ITicketRepository {
  create(data: NewTicket): Promise<Ticket>;
  findById(id: string): Promise<Ticket | null>;
  findByCode(code: string): Promise<Ticket | null>;
  listByOwner(ownerId: string): Promise<Ticket[]>;
  countByEvent(eventId: string): Promise<number>;
  update(id: string, data: Partial<NewTicket>): Promise<Ticket | null>;
}
