import { expect } from "chai";

import RedisManager from "core/db/redis";
import { IPublishedEventDescriptor } from "Modules/Event/entity/event.interface";
import eventCache from "Modules/Event/service/event-cache";

const EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const descriptor: IPublishedEventDescriptor = {
  id: EVENT_ID,
  name: "Lagos Tech Summit",
  description: null,
  venue: "Landmark Centre",
  startsAt: new Date("2026-03-01T09:00:00.000Z"),
};

/**
 * These stub RedisManager rather than standing up a real Redis: the behaviour under test is how
 * this slice reacts when Redis misbehaves, which is exactly what a live instance will not do.
 */
describe("EventCache", () => {
  const original = { get: RedisManager.get, set: RedisManager.set, delete: RedisManager.delete };

  afterEach(() => {
    RedisManager.get = original.get;
    RedisManager.set = original.set;
    RedisManager.delete = original.delete;
  });

  it("reports a miss instead of throwing when Redis is unreachable, so reads fall back to Postgres", async () => {
    RedisManager.get = async () => {
      throw new Error("redis down");
    };

    expect(await eventCache.getDescriptor(EVENT_ID)).to.equal(null);
    expect(await eventCache.getPublishedList()).to.equal(null);
  });

  it("does not fail a write when Redis is unreachable", async () => {
    RedisManager.set = async () => {
      throw new Error("redis down");
    };

    // Resolving is the assertion: a cache write must never break the read it was accelerating.
    await eventCache.setDescriptor(descriptor);
    await eventCache.setPublishedList([descriptor]);
  });

  it("revives dates when reading a cached descriptor back out of JSON", async () => {
    RedisManager.get = async () => JSON.stringify(descriptor);

    const cached = await eventCache.getDescriptor(EVENT_ID);

    expect(cached?.startsAt).to.be.instanceOf(Date);
    expect(cached?.startsAt.toISOString()).to.equal("2026-03-01T09:00:00.000Z");
  });

  it("propagates an invalidation failure so the worker retries rather than leaving a stale entry", async () => {
    RedisManager.delete = async () => {
      throw new Error("redis down");
    };

    try {
      await eventCache.invalidateEvent(EVENT_ID);
      expect.fail("expected invalidateEvent to throw");
    } catch (error) {
      expect((error as Error).message).to.equal("redis down");
    }
  });

  it("clears both the event entry and the list, and is safe to repeat", async () => {
    const deleted: string[] = [];
    RedisManager.delete = async (key: string) => {
      deleted.push(key);
    };

    await eventCache.invalidateEvent(EVENT_ID);
    await eventCache.invalidateEvent(EVENT_ID);

    expect(deleted).to.deep.equal([
      `events:published:${EVENT_ID}`,
      "events:published:list",
      `events:published:${EVENT_ID}`,
      "events:published:list",
    ]);
  });
});
