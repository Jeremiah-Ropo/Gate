import { expect } from "chai";
import request from "supertest";

import { createApp } from "../src/core/App";

describe("Platform API runtime", () => {
  it("bounds an unresponsive readiness dependency", async () => {
    const app = createApp({ readinessCheck: () => new Promise(() => undefined) });
    const response = await request(app).get("/health/ready").timeout({ response: 3000 });
    expect(response.status).to.equal(503);
  });

  it("returns a server-generated request ID for correlation", async () => {
    const response = await request(createApp()).get("/health/live");
    expect(response.headers["x-request-id"]).to.match(/^[0-9a-f-]{36}$/);
  });

  it("reports liveness without consulting dependencies", async () => {
    let readinessChecks = 0;
    const app = createApp({
      readinessCheck: async () => {
        readinessChecks += 1;
      },
      setupRouters: () => undefined,
    });

    const response = await request(app).get("/health/live");

    expect(response.status).to.equal(200);
    expect(response.body).to.deep.equal({ status: "ok", service: "api" });
    expect(readinessChecks).to.equal(0);
  });

  it("reports readiness when required dependencies respond", async () => {
    const app = createApp({ readinessCheck: async () => undefined, setupRouters: () => undefined });

    const response = await request(app).get("/health/ready");

    expect(response.status).to.equal(200);
    expect(response.body).to.deep.equal({ status: "ready", service: "api" });
  });

  it("returns 503 without leaking dependency errors when readiness fails", async () => {
    const app = createApp({
      readinessCheck: async () => {
        throw new Error("postgres://secret-host unavailable");
      },
      setupRouters: () => undefined,
    });

    const response = await request(app).get("/health/ready");

    expect(response.status).to.equal(503);
    expect(response.body).to.deep.equal({ status: "not_ready", service: "api" });
    expect(JSON.stringify(response.body)).not.to.contain("secret-host");
  });
});
