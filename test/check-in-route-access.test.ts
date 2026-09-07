import { randomUUID } from "crypto";
import { expect } from "chai";
import express from "express";
import request from "supertest";

import "../src/core/global/entities/types";
import { ERole } from "../src/core/global/entities/enums";
import { errorHandler } from "../src/core/global/middlewares/error-handler.middleware";
import { createJwtToken } from "../src/core/global/utils/jwt-handler";
import eventMemberService from "../src/Modules/EventMember/service/event-member.service";
import checkInRoutes from "../src/Modules/CheckIn/routes/check-in.routes";

const EVENT_ID = randomUUID();
const DOOR_STAFF = randomUUID();

const validBatch = () => ({
  scans: [{ clientScanId: randomUUID(), ticketCode: "code", scannedAt: new Date().toISOString() }],
});

/**
 * Mounts the real check-in router, so this asserts the guards are actually wired to the route
 * rather than that the middleware works in isolation. Requests carry a genuine signed token,
 * so authentication runs for real.
 *
 * The route's later middleware needs Redis, so an allowed request does not reach a 200 here.
 * What matters for authorization is whether it was refused at the gate, so these assert on
 * 401/403 rather than on the final status -- anything else means the guards let it past.
 */
const app = (() => {
  const instance = express();
  instance.use(express.json());
  instance.use("/check-in", checkInRoutes);
  instance.use(errorHandler);
  return instance;
})();

const tokenFor = (actor: { id: string; role: string }) =>
  createJwtToken({ id: actor.id, email: "door@example.com", role: actor.role } as any);

describe("POST /check-in/events/:eventId/sync access", () => {
  const originalIsActive = eventMemberService.isActiveMember;
  const REFUSED_AT_THE_GATE = [401, 403];

  after(() => {
    eventMemberService.isActiveMember = originalIsActive;
  });

  it("lets an active member of the event past the guards", async () => {
    eventMemberService.isActiveMember = async () => true;

    const res = await request(app)
      .post(`/check-in/events/${EVENT_ID}/sync`)
      .set("Authorization", `Bearer ${tokenFor({ id: DOOR_STAFF, role: ERole.STAFF })}`)
      .send(validBatch());

    expect(res.status).to.not.be.oneOf(REFUSED_AT_THE_GATE);
  });

  it("refuses a revoked member", async () => {
    eventMemberService.isActiveMember = async () => false;

    const res = await request(app)
      .post(`/check-in/events/${EVENT_ID}/sync`)
      .set("Authorization", `Bearer ${tokenFor({ id: DOOR_STAFF, role: ERole.STAFF })}`)
      .send(validBatch());

    expect(res.status).to.equal(403);
  });

  it("refuses staff who are not on this event's door", async () => {
    // The hole this closes: global staff was previously enough to post scans anywhere.
    eventMemberService.isActiveMember = async () => false;

    const res = await request(app)
      .post(`/check-in/events/${EVENT_ID}/sync`)
      .set("Authorization", `Bearer ${tokenFor({ id: randomUUID(), role: ERole.STAFF })}`)
      .send(validBatch());

    expect(res.status).to.equal(403);
  });

  it("refuses an attendee even when they hold an active membership", async () => {
    // Membership alone must not put someone on a door; the global role gate runs first.
    eventMemberService.isActiveMember = async () => true;

    const res = await request(app)
      .post(`/check-in/events/${EVENT_ID}/sync`)
      .set("Authorization", `Bearer ${tokenFor({ id: DOOR_STAFF, role: ERole.ATTENDEE })}`)
      .send(validBatch());

    expect(res.status).to.equal(403);
  });

  it("lets a global admin past the guards without a membership", async () => {
    eventMemberService.isActiveMember = async () => {
      throw new Error("admin should not be looked up");
    };

    const res = await request(app)
      .post(`/check-in/events/${EVENT_ID}/sync`)
      .set("Authorization", `Bearer ${tokenFor({ id: randomUUID(), role: ERole.ADMIN })}`)
      .send(validBatch());

    expect(res.status).to.not.be.oneOf(REFUSED_AT_THE_GATE);
  });
});
