import { Queue } from "bullmq";
import IORedis from "ioredis";

import { REDIS_CONNECTION_STRING } from "core/global/config";
import logger from "core/global/utils/logger";

class QueueManager {
  private static instance: QueueManager;
  public connection: IORedis;
  private queues: Map<string, Queue> = new Map();

  private constructor() {
    this.connection = new IORedis(REDIS_CONNECTION_STRING as string, { maxRetriesPerRequest: null });
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  public async connect(): Promise<void> {
    await this.connection.ping();
    logger.info("Queue connection established");
  }

  public getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(name, new Queue(name, { connection: this.connection }));
    }
    return this.queues.get(name) as Queue;
  }
}

export default QueueManager.getInstance();
