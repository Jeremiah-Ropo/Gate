import { expect } from "chai";

import queueManager from "core/global/shared/queue/queue-manager";
import EventCachePublisher from "Modules/Event/queue/event-cache.publisher";
import { EVENT_CACHE_INVALIDATE, EVENT_CACHE_QUEUE } from "Modules/Event/queue/event-cache.entity";

const EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type AddedJob = { queue: string; name: string; data: any; opts: any };

/**
 * Stubs the queue rather than standing up BullMQ. The behaviour under test is what we hand to
 * `add` — in particular the job id, which BullMQ validates and previously rejected.
 */
describe("EventCachePublisher", () => {
  const originalGetQueue = queueManager.getQueue;
  let added: AddedJob[] = [];

  beforeEach(() => {
    added = [];
    queueManager.getQueue = ((name: string) =>
      ({
        add: async (jobName: string, data: any, opts: any) => {
          added.push({ queue: name, name: jobName, data, opts });
        },
      } as never)) as typeof queueManager.getQueue;
  });

  afterEach(() => {
    queueManager.getQueue = originalGetQueue;
  });

  it("enqueues an invalidation job on the event cache queue", async () => {
    await new EventCachePublisher().publishInvalidation(EVENT_ID, "published");

    expect(added).to.have.lengthOf(1);
    expect(added[0].queue).to.equal(EVENT_CACHE_QUEUE);
    expect(added[0].name).to.equal(EVENT_CACHE_INVALIDATE);
    expect(added[0].data.eventId).to.equal(EVENT_ID);
    expect(added[0].data.reason).to.equal("published");
    expect(added[0].data.version).to.equal(1);
    expect(added[0].data.correlationId).to.be.a("string");
  });

  // Regression: the id used to be built with ':' separators and an ISO timestamp. BullMQ delimits
  // its own Redis keys with ':' and rejects a custom id containing one, so nothing was ever queued
  // and invalidation silently never happened.
  it("uses a job id BullMQ will accept, with no colons in it", async () => {
    await new EventCachePublisher().publishInvalidation(EVENT_ID, "published");

    const { jobId } = added[0].opts;
    expect(jobId).to.be.a("string");
    expect(jobId).to.not.include(":");
    expect(jobId).to.match(/^event-cache-invalidate-[0-9a-f-]+-\d+$/);
  });

  it("gives the same commit the same id, so a duplicate publish collapses", async () => {
    const publisher = new EventCachePublisher();
    await publisher.publishInvalidation(EVENT_ID, "published");
    await publisher.publishInvalidation(EVENT_ID, "published");

    // Same event and same millisecond means the same id; BullMQ drops the second.
    if (added[0].data.committedAt === added[1].data.committedAt) {
      expect(added[0].opts.jobId).to.equal(added[1].opts.jobId);
    }
    // Different commits must not collide.
    expect(added[0].opts.jobId.startsWith(`${EVENT_CACHE_INVALIDATE}-${EVENT_ID}-`)).to.equal(true);
  });

  it("retries with backoff, since a dropped job leaves the cache stale until the TTL", async () => {
    await new EventCachePublisher().publishInvalidation(EVENT_ID, "updated");

    expect(added[0].opts.attempts).to.equal(5);
    expect(added[0].opts.backoff).to.deep.equal({ type: "exponential", delay: 1000 });
  });
});
