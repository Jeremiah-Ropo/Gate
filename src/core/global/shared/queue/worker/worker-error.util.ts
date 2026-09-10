import { Job } from "bullmq";

import logger from "core/global/utils/logger";

const readCorrelationId = (job: Job | undefined): string | undefined => {
  const data = job?.data;
  if (!data || typeof data !== "object" || !("correlationId" in data)) return undefined;
  const correlationId = (data as { correlationId?: unknown }).correlationId;
  return typeof correlationId === "string" ? correlationId : undefined;
};

export const logWorkerFailure = (job: Job | undefined, err: Error): void => {
  logger.error(
    {
      jobName: job?.name,
      jobId: job?.id,
      correlationId: readCorrelationId(job),
      err,
    },
    "Worker job failed",
  );
};
