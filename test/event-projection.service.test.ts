import { expect } from "chai";

import { CustomError } from "core/global/errors";
import { EventProjectionService } from "Modules/Event/service/event-projection.service";
import { FakeEventCache } from "./helpers/fake-event-cache";
import { FakeEventInventoryReader, makeSnapshot } from "./helpers/fake-event-inventory.reader";
import { FakeEventRepository, makeEvent } from "./helpers/fake-event.repository";

const PUBLISHED_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DRAFT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ORGANISER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_ORGANISER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const build = (
  rows = [makeEvent({ id: PUBLISHED_ID })],
  snapshots = [makeSnapshot(PUBLISHED_ID)],
  cache = new FakeEventCache(),
) => {
  const repository = new FakeEventRepository(rows);
  const inventory = new FakeEventInventoryReader(snapshots);
  return { repository, inventory, cache, service: new EventProjectionService(repository, inventory, cache) };
};

describe("EventProjectionService", () => {
  describe("listPublished", () => {
    it("returns only published events, soonest first, with Inventory's figures merged in", async () => {
      const { service } = build(
        [
          makeEvent({ id: PUBLISHED_ID, name: "Lagos Tech Summit", venue: "Landmark Centre" }),
          makeEvent({
            id: OTHER_ID,
            name: "Abuja Design Week",
            slug: "abuja-design-week",
            starts_at: new Date("2026-01-05T09:00:00.000Z"),
          }),
          makeEvent({ id: DRAFT_ID, name: "Unannounced", slug: "unannounced", status: "draft" }),
          makeEvent({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", slug: "called-off", status: "cancelled" }),
        ],
        [makeSnapshot(PUBLISHED_ID, { capacity: 100, reserved: 5, sold: 25 })],
      );

      const events = await service.listPublished();

      expect(events.map((event) => event.name)).to.deep.equal(["Abuja Design Week", "Lagos Tech Summit"]);

      const summit = events[1];
      expect(summit).to.deep.equal({
        id: PUBLISHED_ID,
        name: "Lagos Tech Summit",
        description: null,
        venue: "Landmark Centre",
        startsAt: new Date("2026-03-01T09:00:00.000Z"),
        capacity: 100,
        reserved: 5,
        sold: 25,
        remaining: 70,
      });
      // The projection is the contract other slices build on: internals must not ride along.
      expect(summit).to.not.have.any.keys("createdBy", "slug", "ticketPrice", "coverImage", "status");
    });

    it("returns an empty list when nothing is published", async () => {
      const { service } = build([makeEvent({ status: "draft" })], []);

      expect(await service.listPublished()).to.deep.equal([]);
    });

    it("reads Inventory once for the whole list rather than once per event", async () => {
      const { service, inventory } = build([
        makeEvent({ id: PUBLISHED_ID }),
        makeEvent({ id: OTHER_ID, slug: "second" }),
      ]);

      await service.listPublished();

      expect(inventory.calls).to.equal(1);
    });
  });

  describe("getPublishedById", () => {
    it("returns the event with its live figures", async () => {
      const { service } = build(
        [makeEvent({ id: PUBLISHED_ID })],
        [makeSnapshot(PUBLISHED_ID, { capacity: 250, reserved: 1, sold: 245 })],
      );

      const event = await service.getPublishedById(PUBLISHED_ID);

      expect(event.capacity).to.equal(250);
      expect(event.remaining).to.equal(4);
      expect(event.sold).to.equal(245);
    });

    it("reports figures as null, not zero, when Inventory has no row", async () => {
      const { service } = build([makeEvent({ id: PUBLISHED_ID })], []);

      const event = await service.getPublishedById(PUBLISHED_ID);

      // null means unknown. Zero would read as sold out.
      expect(event.capacity).to.equal(null);
      expect(event.remaining).to.equal(null);
      expect(event.reserved).to.equal(null);
      expect(event.sold).to.equal(null);
      expect(event.name).to.equal("Lagos Tech Summit");
    });

    it("404s for an unknown id", async () => {
      const { service } = build();

      try {
        await service.getPublishedById("99999999-9999-4999-8999-999999999999");
        expect.fail("expected getPublishedById to throw");
      } catch (error) {
        expect(error).to.be.instanceOf(CustomError);
        expect((error as CustomError).HttpStatusCode).to.equal(404);
      }
    });

    it("404s for an unpublished event, so a draft is never served as public", async () => {
      const { service } = build([makeEvent({ id: DRAFT_ID, status: "draft" })], []);

      try {
        await service.getPublishedById(DRAFT_ID);
        expect.fail("expected getPublishedById to throw");
      } catch (error) {
        expect((error as CustomError).HttpStatusCode).to.equal(404);
      }
    });
  });

  describe("listForOrganiser", () => {
    it("returns only the organiser's own events, drafts included, with status", async () => {
      const { service } = build(
        [
          makeEvent({ id: PUBLISHED_ID, createdBy: ORGANISER_ID }),
          makeEvent({ id: DRAFT_ID, slug: "draft-one", createdBy: ORGANISER_ID, status: "draft" }),
          makeEvent({ id: OTHER_ID, slug: "someone-else", createdBy: OTHER_ORGANISER_ID }),
        ],
        [makeSnapshot(PUBLISHED_ID, { capacity: 100, sold: 30 })],
      );

      const events = await service.listForOrganiser(ORGANISER_ID);

      expect(events.map((event) => event.id)).to.have.members([PUBLISHED_ID, DRAFT_ID]);
      expect(events.find((event) => event.id === DRAFT_ID)?.status).to.equal("draft");
      expect(events.find((event) => event.id === PUBLISHED_ID)?.sold).to.equal(30);
      expect(events.find((event) => event.id === PUBLISHED_ID)?.remaining).to.equal(70);
    });
  });

  describe("caching", () => {
    it("serves a second list from cache without touching Postgres", async () => {
      const { service, repository } = build();

      await service.listPublished();
      await service.listPublished();

      expect(repository.reads).to.equal(1);
    });

    it("still reads Inventory on a cache hit, so figures are never served stale", async () => {
      const { service, repository, inventory } = build();

      await service.listPublished();
      await service.listPublished();

      // The whole point of the split: event fields cached, stock figures always fresh.
      expect(repository.reads).to.equal(1);
      expect(inventory.calls).to.equal(2);
    });

    it("falls back to Postgres when the cache is unavailable", async () => {
      const { service, repository } = build([makeEvent({ id: PUBLISHED_ID })], [], new FakeEventCache(true));

      expect(await service.listPublished()).to.have.lengthOf(1);
      expect(await service.listPublished()).to.have.lengthOf(1);
      expect(repository.reads).to.equal(2);
    });

    it("never caches a draft, even when one is requested by id", async () => {
      const { service, cache } = build([makeEvent({ id: DRAFT_ID, status: "draft" })], []);

      try {
        await service.getPublishedById(DRAFT_ID);
        expect.fail("expected getPublishedById to throw");
      } catch {
        /* expected */
      }

      expect(cache.writes).to.equal(0);
    });

    it("never serves the console from cache, since an organiser needs current truth", async () => {
      const { service, repository } = build([makeEvent({ createdBy: ORGANISER_ID })], []);

      await service.listForOrganiser(ORGANISER_ID);
      await service.listForOrganiser(ORGANISER_ID);

      expect(repository.reads).to.equal(2);
    });
  });
});
