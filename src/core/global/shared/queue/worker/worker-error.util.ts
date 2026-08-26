import { Job } from "bullmq";

import logger from "core/global/utils/logger";

export const logWorkerFailure = (job: Job | undefined, err: Error): void => {
  logger.error(`[Worker] Job ${job?.name} (${job?.id}) failed: ${err.message}`);
};
