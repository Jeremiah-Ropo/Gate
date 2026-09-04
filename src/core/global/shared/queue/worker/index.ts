import logger from "core/global/utils/logger";
import { startEventCacheWorker } from "Modules/Event/queue/event-cache.worker";
import { startNotificationWorker } from "./notification.worker";

export const startAllWorkers = async (): Promise<void> => {
  startNotificationWorker();
  // Domain slices own their handlers; this is only the registration point.
  startEventCacheWorker();
  logger.info("All queue workers started");
};
