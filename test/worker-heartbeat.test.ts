import { expect } from "chai";

import { startWorkerHeartbeat } from "../src/core/global/shared/queue/worker/worker-metrics.util";

describe("Worker heartbeat", () => {
  it("updates while the worker is idle", async () => {
    let writes = 0;
    const timer = startWorkerHeartbeat(async () => {
      writes += 1;
    }, 5);

    await new Promise((resolve) => setTimeout(resolve, 18));
    clearInterval(timer);

    expect(writes).to.be.greaterThan(1);
  });
});
