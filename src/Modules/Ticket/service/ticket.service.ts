import { Service } from "typedi";

import { CustomError } from "core/global/errors";
import { ETicketStatus } from "core/global/entities/enums";
import ticketRepository from "../repository/ticket.repository";
import { ITicketService } from "../entity/ticket.interface";
import { Ticket } from "../entity/ticket.model";

@Service()
class TicketService implements ITicketService {
  private static instance: ITicketService;
  private readonly repository = ticketRepository;

  public static getInstance(): ITicketService {
    if (!this.instance) {
      this.instance = new TicketService();
    }
    return this.instance;
  }

  async getById(id: string): Promise<Ticket> {
    const ticket = await this.repository.findById(id);
    if (!ticket) {
      throw new CustomError(404, "NotFound", "Ticket not found");
    }
    return ticket;
  }

  async getByCode(code: string): Promise<Ticket> {
    const ticket = await this.repository.findByCode(code);
    if (!ticket) {
      throw new CustomError(404, "NotFound", "Ticket not found");
    }
    return ticket;
  }

  async listMine(ownerId: string): Promise<Ticket[]> {
    return this.repository.listByOwner(ownerId);
  }

  async voidTicket(id: string): Promise<Ticket> {
    await this.getById(id);
    const updated = await this.repository.update(id, { status: ETicketStatus.VOID });
    if (!updated) {
      throw new CustomError(400, "BadRequest", "Ticket not updated");
    }
    return updated;
  }
}

export default TicketService.getInstance();
