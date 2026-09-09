import { CustomError } from "core/global/errors";
import RedisManager from "core/db/redis";
import logger from "core/global/utils/logger";
import eventInventoryRepository from "../repository/event-inventory.repository";
import eventRepository from "../repository/event.repository";
import { IEventInventoryRepository } from "../entity/event-inventory.interface";
import {
  IConsoleEventRow,
  IEventProjectionService,
  IEventRepository,
  IPublishedEventDescriptor,
  IPublishedEventProjection,
} from "../entity/event.interface";
import { toConsoleRow, toDescriptor, toProjection } from "../entity/event.view";

type RedisStore = Pick<typeof RedisManager, "get" | "set" | "delete">;
type SerializedDescriptor = Omit<IPublishedEventDescriptor, "startsAt"> & { startsAt: string };

const KEY_PREFIX = "events:published";
const LIST_KEY = `${KEY_PREFIX}:list`;
const descriptorKey = (eventId: string): string => `${KEY_PREFIX}:${eventId}`;
const TTL_SECONDS = 15 * 60;

const reviveDescriptor = (raw: SerializedDescriptor): IPublishedEventDescriptor => ({
  ...raw,
  startsAt: new Date(raw.startsAt),
});

/**
 * The read model for events — the surface other slices consume.
 *
 * Event fields are served cache-aside; capacity and the counters come from Inventory's repository
 * and are read live on every request. Only the event fields are cached, because the counters move
 * on claims, which happen in another slice and give this one no invalidation signal. See ADR 0004
 * for the full reasoning.
 *
 * Collaborators arrive through the constructor rather than being imported at module scope, so the
 * read paths can be exercised against fakes with no Postgres, Redis or Inventory present. The wired
 * singleton is the default export, matching how every other service here is consumed.
 */
export class EventProjectionService implements IEventProjectionService {
  constructor(
    private readonly repository: IEventRepository,
    private readonly inventory: IEventInventoryRepository,
    private readonly redis: RedisStore = RedisManager,
  ) {}

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (error) {
      logger.warn(`[EventProjectionService] cache read miss for ${key}: ${error}`);
      return null;
    }
  }

  private async writeCache(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.set(key, value, TTL_SECONDS);
    } catch (error) {
      logger.warn(`[EventProjectionService] cache write skipped for ${key}: ${error}`);
    }
  }

  async listPublished(): Promise<IPublishedEventProjection[]> {
    const cached = await this.readCache<SerializedDescriptor[]>(LIST_KEY);
    let descriptors = cached?.map(reviveDescriptor) ?? null;
    if (!descriptors) {
      descriptors = (await this.repository.listPublished()).map(toDescriptor);
      await this.writeCache(LIST_KEY, descriptors);
    }

    const snapshots = await this.inventory.findByEventIds(descriptors.map((descriptor) => descriptor.id));
    return descriptors.map((descriptor) => toProjection(descriptor, snapshots.get(descriptor.id) ?? null));
  }

  async getPublishedById(id: string): Promise<IPublishedEventProjection> {
    const cached = await this.readCache<SerializedDescriptor>(descriptorKey(id));
    let descriptor = cached ? reviveDescriptor(cached) : null;
    if (!descriptor) {
      // Status is part of the query, so an unpublished event is indistinguishable from a missing
      // one and a draft can never be cached as though it were public.
      const event = await this.repository.findPublishedById(id);
      if (!event) {
        throw new CustomError(404, "NotFound", "Event not found");
      }
      descriptor = toDescriptor(event);
      await this.writeCache(descriptorKey(id), descriptor);
    }

    return toProjection(descriptor, await this.inventory.findByEventId(id));
  }

  /**
   * Removes the event descriptor and published list after a committed mutation. RedisManager is the
   * shared database primitive; the projection service owns only the event-specific keys and retry
   * semantics.
   */
  async invalidateEvent(eventId: string): Promise<void> {
    for (const key of [descriptorKey(eventId), LIST_KEY]) {
      try {
        await this.redis.delete(key);
      } catch (error) {
        logger.error(`[EventProjectionService] failed to invalidate ${key}: ${error}`);
        throw error;
      }
    }
  }

  /**
   * Console reads bypass the cache: an organiser needs current truth, and this includes drafts,
   * which never belong in the published cache in the first place.
   */
  async listForOrganiser(organiserId: string): Promise<IConsoleEventRow[]> {
    const events = await this.repository.listByOrganiser(organiserId);
    const snapshots = await this.inventory.findByEventIds(events.map((event) => event.id));
    return events.map((event) => toConsoleRow(event, snapshots.get(event.id) ?? null));
  }
}

export default new EventProjectionService(eventRepository, eventInventoryRepository);
