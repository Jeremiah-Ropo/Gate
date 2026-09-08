import { expect } from "chai";
import "core/global/entities/types";
import express from "express";
import request from "supertest";
import "core/global/handler/response.handler";
import { errorHandler } from "core/global/middlewares/error-handler.middleware";
import projection from "Modules/Event/service/event-projection.service";
import { createPublicEventRoutes } from "Modules/Event/routes/public-event.routes";

describe("Public events HTTP contract", () => {
  const originalList = projection.listPublished;
  const originalGet = projection.getPublishedById;
  afterEach(() => {
    projection.listPublished = originalList;
    projection.getPublishedById = originalGet;
  });
  const app = () => {
    const server = express();
    server.use("/events", createPublicEventRoutes());
    server.use(errorHandler);
    return server;
  };
  it("allows anonymous published reads through the projection", async () => {
    projection.listPublished = async () => [];
    const result = await request(app()).get("/events");
    expect(result.status).to.equal(200);
    expect(result.body.data).to.deep.equal([]);
  });
  it("rejects malformed IDs before hitting the repository", async () => {
    projection.getPublishedById = async () => {
      throw new Error("should not query");
    };
    expect((await request(app()).get("/events/not-a-uuid")).status).to.equal(400);
  });
});
