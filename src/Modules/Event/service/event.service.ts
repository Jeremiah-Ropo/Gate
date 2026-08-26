import { Service } from "typedi";

import { CustomError } from "core/global/errors";
import { generateUniqueSuffix, slugify } from "core/global/utils/helper";
import cloudinary from "core/providers/cloud-storage/cloudinary";
import eventRepository from "../repository/event.repository";
import { ICreateEventDTO, IEventService, IUpdateEventDTO } from "../entity/event.interface";
import { Event } from "../entity/event.model";

@Service()
class EventService implements IEventService {
  private static instance: IEventService;
  private readonly repository = eventRepository;

  public static getInstance(): IEventService {
    if (!this.instance) {
      this.instance = new EventService();
    }
    return this.instance;
  }

  async createEvent(createdBy: string, payload: ICreateEventDTO): Promise<Event> {
    if (new Date(payload.endDate) <= new Date(payload.startDate)) {
      throw new CustomError(422, "Validation", "endDate must be after startDate");
    }

    let slug = slugify(payload.name);
    if (await this.repository.findBySlug(slug)) {
      slug = `${slug}-${generateUniqueSuffix()}`;
    }

    return this.repository.create({
      name: payload.name,
      slug,
      description: payload.description,
      venue: payload.venue,
      address: payload.address,
      timezone: payload.timezone || "UTC",
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      capacity: payload.capacity,
      ticketPrice: payload.ticketPrice,
      currency: payload.currency || "NGN",
      createdBy,
    });
  }

  async getById(id: string): Promise<Event> {
    const event = await this.repository.findById(id);
    if (!event) {
      throw new CustomError(404, "NotFound", "Event not found");
    }
    return event;
  }

  async list(): Promise<Event[]> {
    return this.repository.list();
  }

  private async assertOwnership(id: string, requesterId: string): Promise<Event> {
    const event = await this.getById(id);
    if (event.createdBy !== requesterId) {
      throw new CustomError(403, "Forbidden", "You do not manage this event");
    }
    return event;
  }

  async updateEvent(id: string, requesterId: string, payload: IUpdateEventDTO): Promise<Event> {
    await this.assertOwnership(id, requesterId);

    const updated = await this.repository.update(id, {
      ...payload,
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
    });
    if (!updated) {
      throw new CustomError(400, "BadRequest", "Event not updated");
    }
    return updated;
  }

  async uploadCoverImage(id: string, requesterId: string, tempFilePath: string): Promise<Event> {
    await this.assertOwnership(id, requesterId);

    const coverImage = await cloudinary.uploadFile(tempFilePath, "events");
    const updated = await this.repository.update(id, { coverImage });
    if (!updated) {
      throw new CustomError(400, "BadRequest", "Cover image not updated");
    }
    return updated;
  }
}

export default EventService.getInstance();
