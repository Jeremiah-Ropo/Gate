import { randomUUID } from "crypto";
import { Service } from "typedi";

import { CustomError } from "core/global/errors";
import { TICKET_CODE_PREFIX } from "core/global/entities/constants";
import { ETicketStatus } from "core/global/entities/enums";
import { generateQrCodeDataUrl } from "core/global/utils/qrcode.utils";
import eventRepository from "Modules/Event/repository/event.repository";
import ticketRepository from "../repository/ticket.repository";
import { IIssueTicketDTO, ITicketService } from "../entity/ticket.interface";
import { Ticket } from "../entity/ticket.model";

@Service()
class TicketService implements ITicketService {
  private static instance: ITicketService;
  private readonly repository = ticketRepository;
  private readonly events = eventRepository;

  public static getInstance(): ITicketService {
    if (!this.instance) {
      this.instance = new TicketService();
    }
    return this.instance;
  }

  async issueTicket(purchaserId: string, payload: IIssueTicketDTO): Promise<Ticket> {
    const event = await this.events.findById(payload.eventId);
    if (!event) {
      throw new CustomError(404, "NotFound", "Event not found");
    }
    if (event.status !== "published") {
      throw new CustomError(400, "BadRequest", "Tickets can only be issued for a published event");
    }

    const issuedCount = await this.repository.countByEvent(event.id);
    if (event.capacity > 0 && issuedCount >= event.capacity) {
      throw new CustomError(409, "Conflict", "This event is sold out");
    }

    const code = `${TICKET_CODE_PREFIX}-${randomUUID().split("-")[0].toUpperCase()}`;
    const qrCodeUrl = await generateQrCodeDataUrl(code);

    const ticket = await this.repository.create({
      eventId: event.id,
      ownerId: purchaserId,
      ownerName: payload.ownerName,
      ownerEmail: payload.ownerEmail,
      code,
      qrCodeUrl,
      status: ETicketStatus.VALID,
    });

    return ticket;
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
