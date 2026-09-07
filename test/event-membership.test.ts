import { randomUUID } from "crypto";
import { expect } from "chai";
import express, { Request } from "express";
import request from "supertest";

import "../src/core/global/entities/types";
import { EMembershipStatus, ERole } from "../src/core/global/entities/enums";
import { errorHandler } from "../src/core/global/middlewares/error-handler.middleware";
import { EventMemberService } from "../src/Modules/EventMember/service/event-member.service";
import eventMemberService from "../src/Modules/EventMember/service/event-member.service";
import RequireEventMemberMiddleware from "../src/Modules/EventMember/middleware/require-event-member.middleware";
import { EventMember } from "../src/Modules/EventMember/entity/event-member.model";

const ORGANIZER = randomUUID();
const OTHER_STAFF = randomUUID();
const ADMIN = randomUUID();
const EVENT_ID = randomUUID();
const DOOR_STAFF = randomUUID();

const event = { id: EVENT_ID, createdBy: ORGANIZER } as any;
const user = { id: DOOR_STAFF, role: ERole.STAFF } as any;

const membership = (status: EMembershipStatus): EventMember =>
  ({ id: randomUUID(), eventId: EVENT_ID, userId: DOOR_STAFF, role: "door_staff", status } as EventMember);

// Only the methods each test actually reaches are implemented; anything else throwing
// would mean the code took a path the test did not intend.
const notImplemented = () => {
  throw new Error("unexpected repository call");
};

function buildService(overrides: { existing?: EventMember | null } = {}) {
  let created: any;
  let updated: any;

  const members = {
    withTx: () => members,
    create: async (data: any) => {
      created = data;
      return membership(EMembershipStatus.ACTIVE);
    },
    findById: notImplemented,
    findByEventAndUser: async () => overrides.existing ?? null,
    listByEvent: async () => [membership(EMembershipStatus.ACTIVE)],
    listActiveEventsForUser: notImplemented,
    update: async (_id: string, data: any) => {
      updated = data;
      return membership(data.status ?? EMembershipStatus.ACTIVE);
    },
  } as any;

  const events = { findById: async () => event } as any;
  const users = { findById: async () => user } as any;

  return {
    service: new EventMemberService(members, events, users),
    get created() {
      return created;
    },
    get updated() {
      return updated;
    },
  };
}

describe("Event membership authorization", () => {
  const organizer = { id: ORGANIZER, email: "o@example.com", role: ERole.STAFF };
  const otherStaff = { id: OTHER_STAFF, email: "s@example.com", role: ERole.STAFF };
  const admin = { id: ADMIN, email: "a@example.com", role: ERole.ADMIN };

  describe("the organizer who created the event", () => {
    it("can add a member", async () => {
      const ctx = buildService();

      await ctx.service.addMember(EVENT_ID, organizer, { userId: DOOR_STAFF });

      expect(ctx.created).to.include({ eventId: EVENT_ID, userId: DOOR_STAFF, status: EMembershipStatus.ACTIVE });
    });

    it("can list and revoke", async () => {
      const ctx = buildService({ existing: membership(EMembershipStatus.ACTIVE) });

      const members = await ctx.service.listForEvent(EVENT_ID, organizer);
      await ctx.service.revoke(EVENT_ID, DOOR_STAFF, organizer);

      expect(members).to.have.lengthOf(1);
      expect(ctx.updated).to.include({ status: EMembershipStatus.REVOKED });
    });
  });

  describe("a staff user who did not create the event", () => {
    // The hole this check closes: global staff is not permission to staff *this* event.
    it("cannot add a member", async () => {
      const ctx = buildService();

      const error = await ctx.service.addMember(EVENT_ID, otherStaff, { userId: DOOR_STAFF }).catch((e) => e);

      expect(error.httpStatusCode).to.equal(403);
      expect(error.errorType).to.equal("Forbidden");
      expect(ctx.created).to.equal(undefined);
    });

    it("cannot list members", async () => {
      const ctx = buildService();

      const error = await ctx.service.listForEvent(EVENT_ID, otherStaff).catch((e) => e);

      expect(error.httpStatusCode).to.equal(403);
      expect(error.errorType).to.equal("Forbidden");
    });

    it("cannot revoke a member", async () => {
      const ctx = buildService({ existing: membership(EMembershipStatus.ACTIVE) });

      const error = await ctx.service.revoke(EVENT_ID, DOOR_STAFF, otherStaff).catch((e) => e);

      expect(error.httpStatusCode).to.equal(403);
      expect(error.errorType).to.equal("Forbidden");
      expect(ctx.updated).to.equal(undefined);
    });
  });

  describe("a global admin", () => {
    // Admins support any event without being added to it; staff do not.
    it("can add a member to an event they did not create", async () => {
      const ctx = buildService();

      await ctx.service.addMember(EVENT_ID, admin, { userId: DOOR_STAFF });

      expect(ctx.created).to.include({ eventId: EVENT_ID, userId: DOOR_STAFF });
    });
  });

  describe("membership status", () => {
    it("treats a revoked member as not active", async () => {
      const ctx = buildService({ existing: membership(EMembershipStatus.REVOKED) });

      expect(await ctx.service.isActiveMember(EVENT_ID, DOOR_STAFF)).to.equal(false);
    });

    it("treats a missing membership as not active", async () => {
      const ctx = buildService({ existing: null });

      expect(await ctx.service.isActiveMember(EVENT_ID, DOOR_STAFF)).to.equal(false);
    });

    it("treats an active membership as active", async () => {
      const ctx = buildService({ existing: membership(EMembershipStatus.ACTIVE) });

      expect(await ctx.service.isActiveMember(EVENT_ID, DOOR_STAFF)).to.equal(true);
    });
  });
});

describe("requireEventMember", () => {
  const original = eventMemberService.isActiveMember;

  const buildApp = (jwtPayload: { id: string; email: string; role: string }) => {
    const app = express();
    app.use((req: Request, _res, next) => {
      req.jwtPayload = jwtPayload as any;
      next();
    });
    app.get("/events/:eventId/door", RequireEventMemberMiddleware.authorize, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(errorHandler);
    return app;
  };

  afterEach(() => {
    eventMemberService.isActiveMember = original;
  });

  it("lets an active member through", async () => {
    eventMemberService.isActiveMember = async () => true;

    const res = await request(buildApp({ id: DOOR_STAFF, email: "d@example.com", role: ERole.STAFF })).get(
      `/events/${EVENT_ID}/door`,
    );

    expect(res.status).to.equal(200);
  });

  it("refuses a revoked member", async () => {
    eventMemberService.isActiveMember = async () => false;

    const res = await request(buildApp({ id: DOOR_STAFF, email: "d@example.com", role: ERole.STAFF })).get(
      `/events/${EVENT_ID}/door`,
    );

    expect(res.status).to.equal(403);
  });

  it("gives a revoked member the same response as one with no membership", async () => {
    // Distinguishing them would let a caller probe for memberships.
    eventMemberService.isActiveMember = async () => false;
    const app = buildApp({ id: DOOR_STAFF, email: "d@example.com", role: ERole.STAFF });

    const revoked = await request(app).get(`/events/${EVENT_ID}/door`);
    const absent = await request(app).get(`/events/${randomUUID()}/door`);

    expect(revoked.status).to.equal(absent.status);
    expect(revoked.body.errorMessage).to.equal(absent.body.errorMessage);
  });

  it("lets a global admin through without a membership", async () => {
    eventMemberService.isActiveMember = async () => {
      throw new Error("admin should not be looked up");
    };

    const res = await request(buildApp({ id: ADMIN, email: "a@example.com", role: ERole.ADMIN })).get(
      `/events/${EVENT_ID}/door`,
    );

    expect(res.status).to.equal(200);
  });
});
