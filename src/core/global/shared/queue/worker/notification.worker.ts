import { Job, Worker } from "bullmq";

import logger from "core/global/utils/logger";
import queueManager from "../queue-manager";
import { logWorkerFailure } from "./worker-error.util";
import EmailTemplateProvider from "../../../../providers/email-template/template-provider";
import NodemailerProvider from "../../../../providers/email-provider/nodemailer";

export const startNotificationWorker = (): Worker => {
  const worker = new Worker(
    "notification-queue",
    async (job: Job) => {
      const html = EmailTemplateProvider.render(job.name, job.data);
      await NodemailerProvider.send({
        to: job.data.email,
        subject: EmailTemplateProvider.subjectFor(job.name),
        html,
      });
    },
    { connection: queueManager.connection },
  );

  worker.on("completed", (job) => logger.info(`[Worker] notification-queue job ${job.id} (${job.name}) completed`));
  worker.on("failed", (job, err) => logWorkerFailure(job, err));

  return worker;
};
