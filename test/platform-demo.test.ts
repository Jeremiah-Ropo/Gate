import { expect } from "chai";
import express, { Request } from "express";
import request from "supertest";

import "../src/core/global/entities/types";
import { ERole } from "../src/core/global/entities/enums";
import { errorHandler } from "../src/core/global/middlewares/error-handler.middleware";
import createPlatformRoutes from "../src/Modules/Platform/routes/platform.routes";

const createDemoApp = (role?: ERole) => {
  const app = express();
  app.use((req: Request, _res, next) => {
    if (role) req.jwtPayload = { id: "demo-user", email: "demo@example.com", role };
    next();
  });
  app.use(createPlatformRoutes());
  app.use(errorHandler);
  return app;
};

describe("Platform demo signals", () => {
  it("is available only to admins", async () => {
    expect((await request(createDemoApp(ERole.ATTENDEE)).post("/demo-signals/healthy")).status).to.equal(403);
    expect((await request(createDemoApp()).post("/demo-signals/healthy")).status).to.equal(401);
  });

  for (const [signal, status] of [
    ["healthy", 200],
    ["unauthorized", 401],
    ["forbidden", 403],
    ["rate-limited", 429],
    ["dependency-down", 503],
  ] as const) {
    it(`emits the ${signal} observability signal without domain input`, async () => {
      const response = await request(createDemoApp(ERole.ADMIN))
        .post(`/demo-signals/${signal}`)
        .send({ eventId: "ignored" });
      expect(response.status).to.equal(status);
    });
  }
});
