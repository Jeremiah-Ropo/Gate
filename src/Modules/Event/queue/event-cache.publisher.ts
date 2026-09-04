import { randomUUID } from "crypto";

import queueManager from "core/global/shared/queue/queue-manager";
import {
  EVENT_CACHE_INVALIDATE,
  EVENT_CACHE_QUEUE,
  EventMutationReason,
  IEventCacheInvalidateJob,
} from "./event-cache.entity";

export default class EventCachePublisher {
  /**
   * Must only be called after the mutation has committed. Publishing inside the transaction would
   * let a rolled-back write evict a still-valid cache entry, and could have the worker read the
   * pre-commit row back into the cache.
   */
  async publishInvalidation(eventId: string, reason: EventMutationReason): Promise<void> {
    const job: IEventCacheInvalidateJob = {
      operation: EVENT_CACHE_INVALIDATE,
      version: 1,
      eventId,
      reason,
      // Until Platform threads a request-scoped correlation id through, this at least ties the
      // job's own log lines together.
      correlationId: randomUUID(),
      committedAt: new Date().toISOString(),
    };

    await queueManager.getQueue(EVENT_CACHE_QUEUE).add(EVENT_CACHE_INVALIDATE, job, {
      // Stable id: a duplicate publish for the same commit is dropped rather than queued twice.
      jobId: `${EVENT_CACHE_INVALIDATE}:${eventId}:${job.committedAt}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }
}
