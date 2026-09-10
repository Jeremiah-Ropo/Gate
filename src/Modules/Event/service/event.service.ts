import { withTransaction, type DbTransaction } from "core/db/postgres";
import { EEventStatus } from "core/global/entities/enums";
import { CustomError } from "core/global/errors";
import { generateUniqueSuffix, slugify } from "core/global/utils/helper";
import cloudStorage from "core/providers/cloud-storage";
import logger from "core/global/utils/logger";
import EventCachePublisher from "../queue/event-cache.publisher";
import { EventMutationReason } from "../queue/event-cache.entity";
import eventInventoryRepository from "../repository/event-inventory.repository";
import eventRepository from "../repository/event.repository";
import { IEventInventoryRepository } from "../entity/event-inventory.interface";
import {
  ICreateEventDTO,
  IEventRepository,
  IEventService,
  IPublishEventDTO,
  IUpdateEventDTO,
} from "../entity/event.interface";
import { Event, NewEvent } from "../entity/event.model";

/** Injected so the write paths can be tested without a live Postgres transaction. */
export type TransactionRunner = <T>(work: (tx: DbTransaction) => Promise<T>) => Promise<T>;

/**
 * Write side of the Events slice. Collaborators arrive through the constructor so the publish and
 * update paths — the two that carry real authorisation weight — can be tested without Postgres.
 */
export class EventService implements IEventService {
  constructor(
    private readonly repository: IEventRepository,
    private readonly inventory: IEventInventoryRepository,
    private readonly runTransaction: TransactionRunner = withTransaction,
  ) {}

  /**
   * Queues cache invalidation for a mutation that has already committed. Deliberately not awaited
   * into the request's failure path: the write is durable by this point, so refusing the response
   * because Redis is unreachable would be the wrong trade. A lost job leaves the cache stale only
   * until the backstop TTL in event-cache.ts.
   */
  private announceCommittedMutation(eventId: string, reason: EventMutationReason): void {
    new EventCachePublisher()
      .publishInvalidation(eventId, reason)
      .catch((err) => logger.error(`[Event] failed to queue cache invalidation for ${eventId}: ${err}`));
  }

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
   * The event row and its inventory row are written in one transaction: Inventory's schema requires
   * the inventory row to exist from the moment the event does, so an event that committed without
   * one could never be claimed and would need manual repair. This is the only path in the system
   * that may set an event to `published`.
   */
  async publishEvent(createdBy: string, payload: IPublishEventDTO): Promise<Event> {
    const slug = await this.buildUniqueSlug(payload.name);

    const event = await this.runTransaction(async (tx) => {
      const event = await this.repository.withTx(tx).create({
        name: payload.name,
        slug,
        description: payload.description,
        venue: payload.venue,
        address: payload.address,
        starts_at: new Date(payload.startsAt),
        ticketPrice: payload.ticketPrice ?? 0,
        currency: payload.currency || "NGN",
        status: EEventStatus.PUBLISHED,
        createdBy,
      });

      await this.inventory.withTx(tx).create({ eventId: event.id, capacity: payload.capacity });
      return event;
    });

    // Published only once the transaction has committed: a rolled-back publish must not evict a
    // still-valid cache entry. A new published event changes what the cached list should contain.
    this.announceCommittedMutation(event.id, "published");
    return event;
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

  /**
   * Builds the update from an explicit allowlist rather than spreading the request body.
   *
   * Spreading let a caller set any column on the row: review reproduced reassigning `createdBy` to
   * take over someone else's event. Anything not named here is ignored, so a new column is opt-in
   * to editing rather than editable by default.
   */
  private buildPatch(payload: IUpdateEventDTO): Partial<NewEvent> {
    const patch: Partial<NewEvent> = {};

    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.venue !== undefined) patch.venue = payload.venue;
    if (payload.address !== undefined) patch.address = payload.address;
    if (payload.coverImage !== undefined) patch.coverImage = payload.coverImage;
    if (payload.ticketPrice !== undefined) patch.ticketPrice = payload.ticketPrice;
    if (payload.startsAt !== undefined) patch.starts_at = new Date(payload.startsAt);
    if (payload.status !== undefined) patch.status = payload.status;

    return patch;
  }

  async updateEvent(id: string, requesterId: string, payload: IUpdateEventDTO): Promise<Event> {
    await this.assertOwnership(id, requesterId);

    // Publication creates the inventory row in the same transaction. Reaching `published` through
    // an ordinary edit would skip that entirely and leave an event nobody can claim a ticket for.
    if (payload.status === EEventStatus.PUBLISHED) {
      throw new CustomError(
        409,
        "Conflict",
        "An event is published through POST /v1/event/publish, so its inventory is created with it",
      );
    }

    const updated = await this.repository.update(id, this.buildPatch(payload));
    if (!updated) {
      throw new CustomError(400, "BadRequest", "Event not updated");
    }

    // Covers status transitions in both directions: an event leaving `published` changes the
    // cached list as much as a rename changes the cached entry.
    this.announceCommittedMutation(updated.id, "updated");
    return updated;
  }

  async uploadCoverImage(id: string, requesterId: string, tempFilePath: string): Promise<Event> {
    await this.assertOwnership(id, requesterId);

    const coverImage = await cloudStorage.uploadFile(tempFilePath, "events");
    const updated = await this.repository.update(id, { coverImage });
    if (!updated) {
      throw new CustomError(400, "BadRequest", "Cover image not updated");
    }
    return updated;
  }
}

export default new EventService(eventRepository, eventInventoryRepository);
