import { Queue } from "bullmq";
import IORedis from "ioredis";

import { REDIS_CONNECTION_STRING } from "core/global/config";
import logger from "core/global/utils/logger";

class QueueManager {
  private static instance: QueueManager;
  public connection: IORedis;
  private queues: Map<string, Queue> = new Map();

  private constructor() {
    this.connection = new IORedis(REDIS_CONNECTION_STRING as string, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  public async connect(): Promise<void> {
    if (this.connection.status === "wait") {
      await this.connection.connect();
    }
    await this.connection.ping();
    logger.info("Queue connection established");
  }

  public async ping(): Promise<void> {
    await this.connection.ping();
  }

  public async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
    if (this.connection.status !== "wait" && this.connection.status !== "end") {
      await this.connection.quit();
    }
  }

  public getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(name, new Queue(name, { connection: this.connection }));
    }
    return this.queues.get(name) as Queue;
  }
}

export default QueueManager.getInstance();
