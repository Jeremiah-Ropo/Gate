import RedisManager from "core/db/redis";
import logger from "core/global/utils/logger";
import { IEventCache, IPublishedEventDescriptor } from "../entity/event.interface";

/**
 * Cache-aside store for published-event descriptors. Events owns the invalidation semantics for
 * this cache, so a note on what is and is not kept here:
 *
 * Only event-owned fields are cached. Inventory's row — capacity and the counters — is deliberately
 * excluded and read live on every request: those numbers move on claims, and a claim is not an
 * event mutation, so caching them would leave stale figures with no invalidation signal to clear
 * them. Cache what this slice mutates; invalidate it from this slice's committed mutations.
 *
 * Invalidation is driven by a BullMQ job published after the write commits, never before, so a
 * rolled-back transaction cannot evict a still-valid entry. The TTL below is a backstop for a
 * dropped job, not the freshness mechanism.
 *
 * Reads and writes swallow Redis failures and degrade to a miss: Postgres decides publication
 * authority, Redis only makes it faster. Invalidation is the exception and rethrows, because it
 * runs inside a worker where a failure must become a retry rather than a silently stale entry.
 * RedisManager's own helpers throw on failure, which is why each call is wrapped here.
 */

// Least sure about: reading Inventory live on every projection request. It is the correct
// boundary, but browse is the hottest path in the system and this puts an inventory query behind
// each one — worth agreeing with Inventory at contract review whether they expose a cached
// counter read instead.
const KEY_PREFIX = "events:published";
const LIST_KEY = `${KEY_PREFIX}:list`;
const descriptorKey = (eventId: string): string => `${KEY_PREFIX}:${eventId}`;

// Backstop only — correctness comes from invalidation, not expiry.
const TTL_SECONDS = 15 * 60;

/** Dates do not survive JSON, so they are revived on the way out. */
type SerializedDescriptor = Omit<IPublishedEventDescriptor, "startsAt"> & { startsAt: string };

const revive = (raw: SerializedDescriptor): IPublishedEventDescriptor => ({
  ...raw,
  startsAt: new Date(raw.startsAt),
});

class EventCache implements IEventCache {
  private static instance: IEventCache;
  private readonly redis = RedisManager;

  public static getInstance(): IEventCache {
    if (!this.instance) {
      this.instance = new EventCache();
    }
    return this.instance;
  }

  private async read<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (error) {
      logger.warn(`[EventCache] read miss for ${key}, falling back to Postgres: ${error}`);
      return null;
    }
  }

  private async write(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), TTL_SECONDS);
    } catch (error) {
      logger.warn(`[EventCache] write skipped for ${key}: ${error}`);
    }
  }

  async getDescriptor(eventId: string): Promise<IPublishedEventDescriptor | null> {
    const raw = await this.read<SerializedDescriptor>(descriptorKey(eventId));
    return raw ? revive(raw) : null;
  }

  async setDescriptor(descriptor: IPublishedEventDescriptor): Promise<void> {
    await this.write(descriptorKey(descriptor.id), descriptor);
  }

  async getPublishedList(): Promise<IPublishedEventDescriptor[] | null> {
    const raw = await this.read<SerializedDescriptor[]>(LIST_KEY);
    return raw ? raw.map(revive) : null;
  }

  async setPublishedList(descriptors: IPublishedEventDescriptor[]): Promise<void> {
    await this.write(LIST_KEY, descriptors);
  }

  /**
   * Drops the event's own entry and the list, since publishing, unpublishing or renaming an event
   * all change what the list should contain. Deleting an absent key is a no-op, which is what
   * makes the invalidation worker safe to retry.
   */
  async invalidateEvent(eventId: string): Promise<void> {
    for (const key of [descriptorKey(eventId), LIST_KEY]) {
      try {
        await this.redis.delete(key);
      } catch (error) {
        logger.error(`[EventCache] failed to invalidate ${key}: ${error}`);
        throw error;
      }
    }
  }
}

export default EventCache.getInstance();
