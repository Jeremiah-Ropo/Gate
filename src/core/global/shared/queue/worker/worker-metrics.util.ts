import { Worker } from "bullmq";
import IORedis from "ioredis";

import queueManager from "core/global/shared/queue/queue-manager";

export const WORKER_HEARTBEAT_KEY = "gate:worker:heartbeat";
export const WORKER_JOBS_COMPLETED_KEY = "gate:worker:jobsCompleted";
export const WORKER_JOBS_FAILED_KEY = "gate:worker:jobsFailed";

const touchHeartbeat = async (connection: IORedis): Promise<void> => {
  await connection.set(WORKER_HEARTBEAT_KEY, new Date().toISOString());
};

export const touchWorkerHeartbeat = async (): Promise<void> => {
  await touchHeartbeat(queueManager.connection);
};

const incrementCounter = async (connection: IORedis, key: string): Promise<void> => {
  await connection.incr(key);
};

export const recordWorkerJobCompleted = async (): Promise<void> => {
  await Promise.all([
    incrementCounter(queueManager.connection, WORKER_JOBS_COMPLETED_KEY),
    touchHeartbeat(queueManager.connection),
  ]);
};

export const recordWorkerJobFailed = async (): Promise<void> => {
  await Promise.all([
    incrementCounter(queueManager.connection, WORKER_JOBS_FAILED_KEY),
    touchHeartbeat(queueManager.connection),
  ]);
};

export const attachWorkerMetrics = (worker: Worker): void => {
  worker.on("completed", () => {
    void recordWorkerJobCompleted();
  });
  worker.on("failed", () => {
    void recordWorkerJobFailed();
  });
};
