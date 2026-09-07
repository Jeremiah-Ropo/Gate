import { Worker } from "bullmq";

import logger from "core/global/utils/logger";
import { startEventCacheWorker } from "Modules/Event/queue/event-cache.worker";
import { startNotificationWorker } from "./notification.worker";

export const startAllWorkers = (): Worker[] => {
  // Domain slices own their handlers; this is only the registration point.
  const workers = [startNotificationWorker(), startEventCacheWorker()];
  logger.info({ workerCount: workers.length }, "All queue workers started");
  return workers;
};

export const closeAllWorkers = async (workers: Worker[]): Promise<void> => {
  await Promise.all(workers.map((worker) => worker.close()));
  logger.info("All queue workers stopped");
};
