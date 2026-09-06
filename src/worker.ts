import "dotenv/config";
import "reflect-metadata";

import { connectDB, disconnectDB } from "core/db/postgres";
import queueManager from "core/global/shared/queue/queue-manager";
import { closeAllWorkers, startAllWorkers } from "core/global/shared/queue/worker";
import logger from "core/global/utils/logger";

export const startWorker = async (): Promise<void> => {
  await connectDB();
  await queueManager.connect();
  const workers = startAllWorkers();
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Worker process shutting down");
    try {
      await closeAllWorkers(workers);
      await Promise.all([queueManager.close(), disconnectDB()]);
      logger.info("Worker process stopped");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Worker shutdown failed");
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  logger.info({ workerCount: workers.length }, "Worker process started");
};

if (require.main === module) {
  startWorker().catch((error) => {
    logger.fatal({ err: error }, "Worker process failed to start");
    process.exit(1);
  });
}
