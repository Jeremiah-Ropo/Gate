import logger from "core/global/utils/logger";
import { startNotificationWorker } from "./notification.worker";

export const startAllWorkers = async (): Promise<void> => {
  startNotificationWorker();
  logger.info("All queue workers started");
};
