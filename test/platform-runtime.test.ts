import { expect } from "chai";
import request from "supertest";

import { createApp } from "../src/core/App";

describe("Platform API runtime", () => {
  it("reports liveness without consulting dependencies", async () => {
    let readinessChecks = 0;
    const app = createApp({
      readinessCheck: async () => {
        readinessChecks += 1;
      },
    });

    const response = await request(app).get("/health/live");

    expect(response.status).to.equal(200);
    expect(response.body).to.deep.equal({ status: "ok", service: "api" });
    expect(readinessChecks).to.equal(0);
  });

  it("reports readiness when required dependencies respond", async () => {
    const app = createApp({ readinessCheck: async () => undefined });

    const response = await request(app).get("/health/ready");

    expect(response.status).to.equal(200);
    expect(response.body).to.deep.equal({ status: "ready", service: "api" });
  });

  it("returns 503 without leaking dependency errors when readiness fails", async () => {
    const app = createApp({
      readinessCheck: async () => {
        throw new Error("postgres://secret-host unavailable");
      },
    });

    const response = await request(app).get("/health/ready");

    expect(response.status).to.equal(503);
    expect(response.body).to.deep.equal({ status: "not_ready", service: "api" });
    expect(JSON.stringify(response.body)).not.to.contain("secret-host");
  });
});
