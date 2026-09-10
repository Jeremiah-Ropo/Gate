import RedisManager from "core/db/redis";
import queueManager from "core/global/shared/queue/queue-manager";
import {
  WORKER_HEARTBEAT_KEY,
  WORKER_JOBS_COMPLETED_KEY,
  WORKER_JOBS_FAILED_KEY,
} from "core/global/shared/queue/worker/worker-metrics.util";
import ticketReservationRepository from "Modules/TicketReservation/repository/ticket-reservation.repository";
import { EVENT_CACHE_QUEUE } from "Modules/Event/queue/event-cache.entity";

const TICKET_RESERVATION_MAINTENANCE_QUEUE = "ticket-reservation-maintenance";

export interface HttpMetricsSnapshot {
  requests: number;
  errors: number;
  status401: number;
  status403: number;
  status429: number;
}

export interface QueueMetricsSnapshot {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export interface PlatformMetricsSnapshot {
  service: "api";
  http: HttpMetricsSnapshot;
  queues: Record<string, QueueMetricsSnapshot>;
  worker: {
    heartbeatAt: string | null;
    jobsCompleted: number;
    jobsFailed: number;
  };
  reservations: {
    overduePending: number;
  };
}

const httpCounters: HttpMetricsSnapshot = {
  requests: 0,
  errors: 0,
  status401: 0,
  status403: 0,
  status429: 0,
};

export function recordHttpResponse(statusCode: number): void {
  httpCounters.requests += 1;
  if (statusCode === 401) httpCounters.status401 += 1;
  if (statusCode === 403) httpCounters.status403 += 1;
  if (statusCode === 429) httpCounters.status429 += 1;
  if (statusCode >= 500) httpCounters.errors += 1;
}

export function getHttpMetricsSnapshot(): HttpMetricsSnapshot {
  return { ...httpCounters };
}

export function resetHttpMetricsForTests(): void {
  httpCounters.requests = 0;
  httpCounters.errors = 0;
  httpCounters.status401 = 0;
  httpCounters.status403 = 0;
  httpCounters.status429 = 0;
}

const parseCounter = (value: string | null): number => {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const METRICS_DEPENDENCY_TIMEOUT_MS = 500;

const readRedisKey = (key: string): Promise<string | null> => {
  if (!RedisManager.client.isOpen) return Promise.resolve(null);
  return RedisManager.get(key);
};

async function withMetricsTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error("Metrics dependency timeout")), METRICS_DEPENDENCY_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return fallback;
  }
}

const toQueueSnapshot = async (queueName: string): Promise<QueueMetricsSnapshot> => {
  const empty = { waiting: 0, active: 0, delayed: 0, failed: 0 };
  if (queueManager.connection.status !== "ready") return empty;

  return withMetricsTimeout(
    queueManager
      .getQueue(queueName)
      .getJobCounts("waiting", "active", "delayed", "failed")
      .then((counts) => ({
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      })),
    empty,
  );
};

export async function collectPlatformMetrics(): Promise<PlatformMetricsSnapshot> {
  const [eventCacheQueue, reservationQueue, heartbeatAt, jobsCompletedRaw, jobsFailedRaw, overduePending] =
    await Promise.all([
      toQueueSnapshot(EVENT_CACHE_QUEUE),
      toQueueSnapshot(TICKET_RESERVATION_MAINTENANCE_QUEUE),
      withMetricsTimeout(readRedisKey(WORKER_HEARTBEAT_KEY), null),
      withMetricsTimeout(readRedisKey(WORKER_JOBS_COMPLETED_KEY), null),
      withMetricsTimeout(readRedisKey(WORKER_JOBS_FAILED_KEY), null),
      withMetricsTimeout(ticketReservationRepository.countOverduePending(), 0),
    ]);

  return {
    service: "api",
    http: getHttpMetricsSnapshot(),
    queues: {
      [EVENT_CACHE_QUEUE]: eventCacheQueue,
      [TICKET_RESERVATION_MAINTENANCE_QUEUE]: reservationQueue,
    },
    worker: {
      heartbeatAt,
      jobsCompleted: parseCounter(jobsCompletedRaw),
      jobsFailed: parseCounter(jobsFailedRaw),
    },
    reservations: {
      overduePending,
    },
  };
}
