import "dotenv/config";
import "reflect-metadata";
import { createServer } from "http";

import { connectDB, disconnectDB } from "core/db/postgres";
import RedisManager from "core/db/redis";
import queueManager from "core/global/shared/queue/queue-manager";
import { closeAllWorkers, startAllWorkers } from "core/global/shared/queue/worker";
import logger from "core/global/utils/logger";

function listenForRenderHealth(): void {
  const port = Number(process.env.PORT);
  if (!port) return;
  createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  }).listen(port, "0.0.0.0", () => logger.info({ port }, "Worker health listener started"));
}

export const startWorker = async (): Promise<void> => {
  await connectDB();
  await RedisManager.connect();
  await queueManager.connect();
  const workers = await startAllWorkers();
  listenForRenderHealth();
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Worker process shutting down");
    try {
      await closeAllWorkers(workers);
      await Promise.all([queueManager.close(), RedisManager.disconnect(), disconnectDB()]);
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
