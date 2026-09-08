import { Worker } from "bullmq";

import { startTicketReservationWorker } from "Modules/TicketReservation/worker/ticket-reservation.worker";
import { startEventCacheWorker } from "Modules/Event/queue/event-cache.worker";
import logger from "core/global/utils/logger";

export const startAllWorkers = async (): Promise<Worker[]> => {
  const ticketReservationWorker = await startTicketReservationWorker();
  // Domain slices own their handlers; this is only the registration point.
  const workers: Worker[] = [ticketReservationWorker, startEventCacheWorker()];
  logger.info({ workerCount: workers.length }, "All queue workers started");
  return workers;
};

export const closeAllWorkers = async (workers: Worker[]): Promise<void> => {
  await Promise.all(workers.map((worker) => worker.close()));
  logger.info("All queue workers stopped");
};
