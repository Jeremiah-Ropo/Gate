import { expect } from "chai";
import express, { Request } from "express";
import { MemoryStore } from "express-rate-limit";
import request from "supertest";

import { ERole } from "../src/core/global/entities/enums";
import "../src/core/global/entities/types";
import { errorHandler } from "../src/core/global/middlewares/error-handler.middleware";
import AuthGuardMiddleware, { rolePolicies } from "../src/core/global/middlewares/auth-guard.middleware";
import { rateLimitPolicies, throttleMiddleware } from "../src/core/global/middlewares/throttle.middleware";

describe("Platform access policy", () => {
  const createRoleApp = () => {
    const app = express();
    app.use((req: Request, _res, next) => {
      const role = req.header("x-test-role");
      if (role) {
        req.jwtPayload = { id: "user-1", email: "user@example.com", role };
      }
      next();
    });
    app.get("/organizer", AuthGuardMiddleware.authorize(rolePolicies.organizer), (_req, res) => res.status(204).end());
    app.use(errorHandler);
    return app;
  };

  it("requires authentication context before checking roles", async () => {
    const response = await request(createRoleApp()).get("/organizer");

    expect(response.status).to.equal(401);
  });

  it("denies attendees access to organizer operations", async () => {
    const response = await request(createRoleApp()).get("/organizer").set("x-test-role", ERole.ATTENDEE);

    expect(response.status).to.equal(403);
  });

  for (const role of [ERole.STAFF, ERole.ADMIN]) {
    it(`allows ${role} access to organizer operations`, async () => {
      const response = await request(createRoleApp()).get("/organizer").set("x-test-role", role);

      expect(response.status).to.equal(204);
    });
  }
});

describe("Platform rate-limit policy", () => {
  it("limits an authenticated identity across different IP addresses", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use((req: Request, _res, next) => {
      req.jwtPayload = {
        id: req.header("x-test-user") || "user-1",
        email: "user@example.com",
        role: ERole.ATTENDEE,
      };
      next();
    });
    app.get("/claim", throttleMiddleware({ ...rateLimitPolicies.claim, limit: 2 }, new MemoryStore()), (_req, res) =>
      res.status(204).end(),
    );

    expect((await request(app).get("/claim").set("x-forwarded-for", "198.51.100.1")).status).to.equal(204);
    expect((await request(app).get("/claim").set("x-forwarded-for", "198.51.100.2")).status).to.equal(204);

    const limited = await request(app).get("/claim").set("x-forwarded-for", "198.51.100.3");
    expect(limited.status).to.equal(429);
    expect(limited.headers).to.have.property("retry-after");
    expect(limited.body).to.deep.include({
      errorType: "TooManyRequests",
      success: false,
    });

    const otherUser = await request(app).get("/claim").set("x-test-user", "user-2");
    expect(otherUser.status).to.equal(204);
  });

  it("assigns an independent namespace to every policy", () => {
    const names = Object.values(rateLimitPolicies).map((policy) => policy.name);

    expect(new Set(names).size).to.equal(names.length);
  });
});
