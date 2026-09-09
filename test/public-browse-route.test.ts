import { expect } from "chai";
import express from "express";
import request from "supertest";

import "core/global/entities/types";
import "core/global/handler/response.handler";
import { errorHandler } from "core/global/middlewares/error-handler.middleware";
import { CustomError } from "core/global/errors";
import { eventProjectionService } from "Modules/Event";
import createPublicEventRoutes from "Modules/PublicBrowse/routes/public-event.routes";

const PUBLISHED_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * Stubs eventProjectionService directly rather than standing up Postgres/Redis: this route
 * layer owns nothing but the anonymous HTTP surface (see ADR 0010), so what's under test is
 * that surface — no auth, correct shaping, and that a bad id never reaches the service at all.
 */
describe("Public browse HTTP contract", () => {
  const original = {
    listPublished: eventProjectionService.listPublished,
    getPublishedById: eventProjectionService.getPublishedById,
  };

  afterEach(() => {
    eventProjectionService.listPublished = original.listPublished;
    eventProjectionService.getPublishedById = original.getPublishedById;
  });

  const app = () => {
    const server = express();
    server.use("/events", createPublicEventRoutes());
    server.use(errorHandler);
    return server;
  };

  it("serves the published list with no auth required", async () => {
    eventProjectionService.listPublished = async () => [
      {
        id: PUBLISHED_ID,
        name: "Lagos Tech Summit",
        description: null,
        venue: "Landmark Centre",
        address: null,
        coverImage: null,
        startsAt: new Date("2026-03-01T09:00:00.000Z"),
        ticketPrice: 15000,
        currency: "NGN",
        capacity: 100,
        reserved: 10,
        sold: 20,
        remaining: 70,
      },
    ];

    const result = await request(app()).get("/events");

    expect(result.status).to.equal(200);
    expect(result.body.data).to.have.length(1);
    expect(result.body.data[0]).to.deep.equal({
      id: PUBLISHED_ID,
      name: "Lagos Tech Summit",
      description: null,
      venue: "Landmark Centre",
      address: null,
      coverImage: null,
      startsAt: "2026-03-01T09:00:00.000Z",
      ticketPrice: 15000,
      currency: "NGN",
      capacity: 100,
      remaining: 70,
    });
  });

  it("never exposes Inventory's reserved/sold bookkeeping", async () => {
    eventProjectionService.listPublished = async () => [
      {
        id: PUBLISHED_ID,
        name: "Lagos Tech Summit",
        description: null,
        venue: null,
        address: null,
        coverImage: null,
        startsAt: new Date("2026-03-01T09:00:00.000Z"),
        ticketPrice: 0,
        currency: "NGN",
        capacity: 100,
        reserved: 10,
        sold: 20,
        remaining: 70,
      },
    ];

    const result = await request(app()).get("/events");

    expect(result.body.data[0]).to.not.have.any.keys("reserved", "sold");
  });

  it("rejects a malformed id before it reaches the projection service", async () => {
    eventProjectionService.getPublishedById = async () => {
      throw new Error("should not be called for a malformed id");
    };

    const result = await request(app()).get("/events/not-a-uuid");

    expect(result.status).to.equal(422);
  });

  it("404s a draft/cancelled/nonexistent id exactly as the projection service reports it", async () => {
    eventProjectionService.getPublishedById = async () => {
      throw new CustomError(404, "NotFound", "Event not found");
    };

    const result = await request(app()).get(`/events/${PUBLISHED_ID}`);

    expect(result.status).to.equal(404);
  });
});
