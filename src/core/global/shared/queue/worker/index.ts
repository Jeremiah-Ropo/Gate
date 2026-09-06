import { Worker } from "bullmq";

import logger from "core/global/utils/logger";
import { startNotificationWorker } from "./notification.worker";

export const startAllWorkers = (): Worker[] => {
  const workers = [startNotificationWorker()];
  logger.info({ workerCount: workers.length }, "All queue workers started");
  return workers;
};

export const closeAllWorkers = async (workers: Worker[]): Promise<void> => {
  await Promise.all(workers.map((worker) => worker.close()));
  logger.info("All queue workers stopped");
};
