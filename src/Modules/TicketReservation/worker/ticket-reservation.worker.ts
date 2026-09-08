import { Worker } from "bullmq";

import {
  RESERVATION_EXPIRY_BATCH_SIZE,
  RESERVATION_EXPIRY_MAX_EVENTS,
  RESERVATION_EXPIRY_SWEEP_INTERVAL_MS,
  PAYMENT_RECOVERY_SWEEP_INTERVAL_MS,
} from "core/global/config";
import queueManager from "core/global/shared/queue/queue-manager";
import { logWorkerFailure } from "core/global/shared/queue/worker/worker-error.util";
import logger from "core/global/utils/logger";
import ticketReservationService from "../service/ticket-reservation.service";

export const TICKET_RESERVATION_MAINTENANCE_QUEUE = "ticket-reservation-maintenance";
const RESERVATION_EXPIRY_SCHEDULER_ID = "reservation-expiry-sweep";
const RESERVATION_EXPIRY_JOB_NAME = "reservation-expiry-sweep";
const PAYMENT_RECOVERY_SCHEDULER_ID = "payment-recovery-sweep";
const PAYMENT_RECOVERY_JOB_NAME = "payment-recovery-sweep";

export const startTicketReservationWorker = async (): Promise<Worker> => {
  const queue = queueManager.getQueue(TICKET_RESERVATION_MAINTENANCE_QUEUE);

  await queue.upsertJobScheduler(
    RESERVATION_EXPIRY_SCHEDULER_ID,
    { every: RESERVATION_EXPIRY_SWEEP_INTERVAL_MS },
    {
      name: RESERVATION_EXPIRY_JOB_NAME,
      data: { batchSize: RESERVATION_EXPIRY_BATCH_SIZE, maxEvents: RESERVATION_EXPIRY_MAX_EVENTS },
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    },
  );
  await queue.upsertJobScheduler(
    PAYMENT_RECOVERY_SCHEDULER_ID,
    { every: PAYMENT_RECOVERY_SWEEP_INTERVAL_MS },
    {
      name: PAYMENT_RECOVERY_JOB_NAME,
      data: {},
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    },
  );

  const worker = new Worker(
    TICKET_RESERVATION_MAINTENANCE_QUEUE,
    async (job) => {
      if (job.name === PAYMENT_RECOVERY_JOB_NAME) {
        let recoveredCount = 0;
        let status = await ticketReservationService.recoverOneStalePayment();

        while (status !== "none") {
          recoveredCount += 1;
          logger.info({ jobId: job.id, status }, "Processed stale payment recovery");
          status = await ticketReservationService.recoverOneStalePayment();
        }

        return { recoveredCount };
      }

      if (job.name === RESERVATION_EXPIRY_JOB_NAME) {
        const expiredCount = await ticketReservationService.expireOverdueBatch(job.data.batchSize, job.data.maxEvents);
        if (expiredCount > 0) {
          logger.info({ expiredCount, jobId: job.id }, "Expired overdue reservations");
        }
        return { expiredCount };
      }

      throw new Error(`Unknown ticket reservation job: ${job.name}`);
    },
    { connection: queueManager.connection, concurrency: 1 },
  );

  worker.on("failed", (job, error) => logWorkerFailure(job, error));
  return worker;
};
