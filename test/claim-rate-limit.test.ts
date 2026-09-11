import { randomUUID } from "crypto";
import { expect } from "chai";
import express, { NextFunction, Request, Response } from "express";
import { MemoryStore } from "express-rate-limit";
import request from "supertest";

import "../src/core/global/entities/types";
import { ERole } from "../src/core/global/entities/enums";
import { errorHandler } from "../src/core/global/middlewares/error-handler.middleware";
import { rateLimitPolicies, throttleMiddleware } from "../src/core/global/middlewares/throttle.middleware";
import createTicketReservationRoutes from "../src/Modules/TicketReservation/routes/ticket-reservation.routes";

const CLAIM_LIMIT = rateLimitPolicies.claim.limit;

/**
 * Mounts the real reservation router, so this asserts the claim policy is wired to the claim route
 * rather than that the limiter works on its own. In Routers.ts the router sits behind authenticate,
 * so the actor is stubbed here the way that guard would set it.
 *
 * No request carries an Idempotency-Key, so anything that clears the limiter stops at the 400 from
 * the idempotency guard before it needs Redis. What is being asserted is 429 versus not-429.
 */
const app = (() => {
  const instance = express();
  instance.use(express.json());
  instance.use((req: Request, _res: Response, next: NextFunction) => {
    req.jwtPayload = {
      id: req.headers["x-actor"] as string,
      email: "attendee@example.com",
      role: ERole.ATTENDEE,
      sessionId: "claim-limit-session",
    };
    next();
  });
  instance.use(createTicketReservationRoutes((policy) => throttleMiddleware(policy, new MemoryStore())));
  instance.use(errorHandler);
  return instance;
})();

const claimAs = (actorId: string) =>
  request(app).post("/reservations").set("x-actor", actorId).send({ eventId: randomUUID(), quantity: 1 });

describe("claim rate limit", () => {
  it("lets an attendee through for the first five claims in the window", async () => {
    const actorId = randomUUID();

    for (let attempt = 0; attempt < CLAIM_LIMIT; attempt += 1) {
      const res = await claimAs(actorId);
      expect(res.status, `claim ${attempt + 1} should not be limited`).to.not.equal(429);
    }
  });

  it("refuses the sixth claim from the same attendee", async () => {
    const actorId = randomUUID();
    for (let attempt = 0; attempt < CLAIM_LIMIT; attempt += 1) await claimAs(actorId);

    const res = await claimAs(actorId);

    expect(res.status).to.equal(429);
    expect(res.body.errorType).to.equal("TooManyRequests");
  });

  it("counts per attendee, so one account cannot exhaust another's claims", async () => {
    // The hole this closes: an IP-keyed limit would let one noisy attendee block everyone
    // sharing a venue's network.
    const noisy = randomUUID();
    for (let attempt = 0; attempt <= CLAIM_LIMIT; attempt += 1) await claimAs(noisy);

    const res = await claimAs(randomUUID());

    expect(res.status).to.not.equal(429);
  });

  it("does not apply the claim limit to reading a reservation", async () => {
    const actorId = randomUUID();
    const reservationId = randomUUID();

    for (let attempt = 0; attempt <= CLAIM_LIMIT; attempt += 1) {
      const res = await request(app).get(`/reservations/${reservationId}`).set("x-actor", actorId);
      expect(res.status, "reads are covered by standard-user, not by the claim policy").to.not.equal(429);
    }
  });
});
