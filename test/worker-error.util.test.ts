import { expect } from "chai";
import { Job } from "bullmq";

import { logWorkerFailure } from "core/global/shared/queue/worker/worker-error.util";
import logger from "core/global/utils/logger";

describe("logWorkerFailure", () => {
  const originalError = logger.error;
  let logged: unknown[][];

  beforeEach(() => {
    logged = [];
    logger.error = (...args: unknown[]) => {
      logged.push(args);
    };
  });

  afterEach(() => {
    logger.error = originalError;
  });

  it("includes correlationId when the job envelope carries one", () => {
    const job = {
      name: "event-cache-invalidate",
      id: "event-cache-invalidate-test",
      data: { correlationId: "22222222-2222-4222-8222-222222222222" },
    } as Job;

    logWorkerFailure(job, new Error("cache write failed"));

    expect(logged).to.have.lengthOf(1);
    expect(logged[0][0]).to.deep.include({
      jobName: "event-cache-invalidate",
      jobId: "event-cache-invalidate-test",
      correlationId: "22222222-2222-4222-8222-222222222222",
    });
    expect(logged[0][1]).to.equal("Worker job failed");
  });
});
