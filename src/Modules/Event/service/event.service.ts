import { EEventStatus } from "core/global/entities/enums";
import { CustomError } from "core/global/errors";
import { generateUniqueSuffix, slugify } from "core/global/utils/helper";
import cloudinary from "core/providers/cloud-storage/cloudinary";
import eventRepository from "../repository/event.repository";
import {
  ICreateEventDTO,
  IEventRepository,
  IEventService,
  IPublishEventDTO,
  IUpdateEventDTO,
} from "../entity/event.interface";
import { Event } from "../entity/event.model";

/**
 * Write side of the Events slice. The repository is a constructor argument so the publish path —
 * which is the one place this slice writes Inventory's table — can be tested without Postgres.
 */
export class EventService implements IEventService {
  constructor(private readonly repository: IEventRepository) {}

  private async buildUniqueSlug(name: string): Promise<string> {
    const slug = slugify(name);
    if (await this.repository.findBySlug(slug)) {
      return `${slug}-${generateUniqueSuffix()}`;
    }
    return slug;
  }

  async createEvent(createdBy: string, payload: ICreateEventDTO): Promise<Event> {
    return this.repository.create({
      name: payload.name,
      slug: await this.buildUniqueSlug(payload.name),
      description: payload.description,
      venue: payload.venue,
      address: payload.address,
      starts_at: new Date(payload.startsAt),
      ticketPrice: payload.ticketPrice,
      currency: payload.currency || "NGN",
      createdBy,
    });
  }

  /**
   * Creates an event already published, with a fixed ticket count.
   *
   * The count is the capacity of the event's inventory row, created in the same transaction — the
   * only write this slice makes to Inventory's table. Events never touches a counter afterwards,
   * and offers no way to change capacity: that would be an Inventory operation.
   */
  async publishEvent(createdBy: string, payload: IPublishEventDTO): Promise<Event> {
    return this.repository.createPublishedWithInventory(
      {
        name: payload.name,
        slug: await this.buildUniqueSlug(payload.name),
        description: payload.description,
        venue: payload.venue,
        address: payload.address,
        starts_at: new Date(payload.startsAt),
        ticketPrice: payload.ticketPrice ?? 0,
        currency: payload.currency || "NGN",
        status: EEventStatus.PUBLISHED,
        createdBy,
      },
      payload.capacity,
    );
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

    // startsAt is the DTO's name for the starts_at column; everything else maps straight through.
    const { startsAt, ...rest } = payload;
    const updated = await this.repository.update(id, {
      ...rest,
      ...(startsAt ? { starts_at: new Date(startsAt) } : {}),
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

export default new EventService(eventRepository);
