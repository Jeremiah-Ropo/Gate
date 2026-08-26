import queueManager from "../queue-manager";
import { NotificationJob } from "./notification.entity";

export default class NotificationPublisher {
  private queueName = "notification-queue";

  async publish(job: NotificationJob): Promise<void> {
    const queue = queueManager.getQueue(this.queueName);
    await queue.add(job.type, job.data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }
}
