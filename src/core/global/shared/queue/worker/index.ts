import { Worker } from "bullmq";

import { startTicketReservationWorker } from "Modules/TicketReservation/worker/ticket-reservation.worker";
import logger from "core/global/utils/logger";

export const startAllWorkers = async (): Promise<Worker[]> => {
  const ticketReservationWorker = await startTicketReservationWorker();
  const workers = [ticketReservationWorker];
  logger.info({ workerCount: workers.length }, "All queue workers started");
  return workers;
};

export const closeAllWorkers = async (workers: Worker[]): Promise<void> => {
  await Promise.all(workers.map((worker) => worker.close()));
  logger.info("All queue workers stopped");
};
