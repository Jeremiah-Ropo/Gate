import { Job, Worker } from "bullmq";

import queueManager from "core/global/shared/queue/queue-manager";
import { logWorkerFailure } from "core/global/shared/queue/worker/worker-error.util";
import logger from "core/global/utils/logger";
import eventCache from "../service/event-cache";
import { EVENT_CACHE_QUEUE, IEventCacheInvalidateJob } from "./event-cache.entity";

/**
 * Idempotent by construction: the handler only deletes keys, and deleting an absent key is a no-op,
 * so a retry or a duplicate job cannot do damage. Failures propagate so BullMQ retries — dropping
 * one would leave the cache stale with nothing left to clear it but the backstop TTL.
 */
export const startEventCacheWorker = (): Worker => {
  const worker = new Worker(
    EVENT_CACHE_QUEUE,
    async (job: Job<IEventCacheInvalidateJob>) => {
      if (job.data.version !== 1) {
        throw new Error(`Unsupported ${job.name} envelope version: ${job.data.version}`);
      }
      await eventCache.invalidateEvent(job.data.eventId);
      logger.info(
        `[EventCache] invalidated event ${job.data.eventId} after ${job.data.reason} (correlationId=${job.data.correlationId})`,
      );
    },
    { connection: queueManager.connection },
  );

  worker.on("failed", (job, err) => logWorkerFailure(job, err));

  return worker;
};
