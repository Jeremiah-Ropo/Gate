import { expect } from "chai";

import { EEventStatus } from "core/global/entities/enums";
import { CustomError } from "core/global/errors";
import { EventService } from "Modules/Event/service/event.service";
import { FakeEventCache } from "./helpers/fake-event-cache";
import { FakeEventInventoryRepository } from "./helpers/fake-event-inventory.repository";
import { FakeEventRepository, makeEvent } from "./helpers/fake-event.repository";

const ORGANISER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ATTACKER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const publishPayload = {
  name: "Lagos Tech Summit",
  startsAt: "2026-03-01T09:00:00.000Z",
  capacity: 250,
};

/** The fake repositories share one in-memory store, so the runner just hands over a stub handle. */
const build = (rows = [] as ReturnType<typeof makeEvent>[]) => {
  const repository = new FakeEventRepository(rows);
  const inventory = new FakeEventInventoryRepository();
  const cache = new FakeEventCache();
  const service = new EventService(repository, inventory, async (work) => work({} as never), cache);
  return { repository, inventory, cache, service };
};

/**
 * Invalidation is fired off without being awaited, so the assertions below yield once to let the
 * already-resolved promise settle rather than reaching into the service for a handle on it.
 */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("EventService.publishEvent", () => {
  it("creates the event already published", async () => {
    const { service } = build();

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);

    expect(event.status).to.equal("published");
    expect(event.createdBy).to.equal(ORGANISER_ID);
    expect(event.starts_at.toISOString()).to.equal("2026-03-01T09:00:00.000Z");
  });

  it("creates the inventory row with the ticket count, inside the same transaction", async () => {
    const { service, inventory } = build();

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);

    // Inventory's schema requires the row to exist from the moment the event does.
    expect(inventory.created).to.deep.equal([{ eventId: event.id, capacity: 250 }]);
  });

  it("defaults ticket price to zero, since payments belong to another slice", async () => {
    const { service } = build();

    expect((await service.publishEvent(ORGANISER_ID, publishPayload)).ticketPrice).to.equal(0);
  });

  it("gives a clashing name a unique slug rather than failing on the unique index", async () => {
    const { service } = build([makeEvent({ slug: "lagos-tech-summit" })]);

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);

    expect(event.slug).to.match(/^lagos-tech-summit-[0-9a-f]{6}$/);
  });
});

describe("EventService.updateEvent", () => {
  const draft = () => makeEvent({ id: EVENT_ID, status: "draft", createdBy: ORGANISER_ID });

  it("applies the fields an organiser is allowed to edit", async () => {
    const { service } = build([draft()]);

    const updated = await service.updateEvent(EVENT_ID, ORGANISER_ID, {
      name: "Renamed Summit",
      venue: "Eko Hotel",
    });

    expect(updated.name).to.equal("Renamed Summit");
    expect(updated.venue).to.equal("Eko Hotel");
  });

  // Regression: review reproduced reassigning ownership by passing createdBy in the body, because
  // the payload used to be spread straight into the update.
  it("ignores fields outside the allowlist, so ownership cannot be reassigned", async () => {
    const { service } = build([draft()]);

    const updated = await service.updateEvent(EVENT_ID, ORGANISER_ID, {
      name: "Renamed Summit",
      createdBy: ATTACKER_ID,
      slug: "hijacked",
      id: "99999999-9999-4999-8999-999999999999",
    } as never);

    expect(updated.createdBy).to.equal(ORGANISER_ID);
    expect(updated.slug).to.equal("lagos-tech-summit");
    expect(updated.id).to.equal(EVENT_ID);
    expect(updated.name).to.equal("Renamed Summit");
  });

  // Regression: publishing this way would skip the transaction that creates the inventory row,
  // leaving an event on the public catalogue that nobody can claim a ticket for.
  it("refuses to publish a draft through an ordinary edit", async () => {
    const { service, inventory } = build([draft()]);

    try {
      await service.updateEvent(EVENT_ID, ORGANISER_ID, { status: EEventStatus.PUBLISHED });
      expect.fail("expected updateEvent to reject publication");
    } catch (error) {
      expect(error).to.be.instanceOf(CustomError);
      expect((error as CustomError).HttpStatusCode).to.equal(409);
    }

    expect(inventory.created).to.deep.equal([]);
  });

  it("still allows other status transitions, such as cancelling", async () => {
    const { service } = build([makeEvent({ id: EVENT_ID, createdBy: ORGANISER_ID })]);

    const updated = await service.updateEvent(EVENT_ID, ORGANISER_ID, { status: EEventStatus.CANCELLED });

    expect(updated.status).to.equal("cancelled");
  });

  it("refuses an edit from someone who does not own the event", async () => {
    const { service } = build([draft()]);

    try {
      await service.updateEvent(EVENT_ID, ATTACKER_ID, { name: "Renamed" });
      expect.fail("expected updateEvent to reject a non-owner");
    } catch (error) {
      expect((error as CustomError).HttpStatusCode).to.equal(403);
    }
  });

  it("lets a global admin edit an event they did not create", async () => {
    const { service } = build([draft()]);

    const updated = await service.updateEvent(EVENT_ID, ATTACKER_ID, { name: "Admin rename" }, "admin");
    expect(updated.name).to.equal("Admin rename");
  });
});

describe("EventService.deleteEvent", () => {
  it("cancels the event and refuses a non-owner", async () => {
    const { service } = build([makeEvent({ id: EVENT_ID, createdBy: ORGANISER_ID })]);

    const deleted = await service.deleteEvent(EVENT_ID, ORGANISER_ID);
    expect(deleted.status).to.equal("cancelled");

    try {
      await service.deleteEvent(EVENT_ID, ATTACKER_ID);
      expect.fail("expected deleteEvent to reject a non-owner");
    } catch (error) {
      expect((error as CustomError).HttpStatusCode).to.equal(403);
    }
  });
});

/**
 * Regression: invalidation used to be queued for the worker and nothing else. That worker is a
 * free-plan instance which spins down when idle, so a newly published event kept serving from a
 * stale cached list until the backstop TTL expired. The committed write now clears the cache
 * itself, and the queued job is redundancy rather than the only mechanism.
 */
describe("EventService cache invalidation", () => {
  it("clears the cache inline when an event is published, without waiting for the worker", async () => {
    const { service, cache } = build();

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);
    await settle();

    expect(cache.invalidated).to.deep.equal([event.id]);
  });

  it("clears the cache when an event is edited", async () => {
    const { service, cache } = build([makeEvent({ id: EVENT_ID, createdBy: ORGANISER_ID })]);

    await service.updateEvent(EVENT_ID, ORGANISER_ID, { name: "Renamed Summit" });
    await settle();

    expect(cache.invalidated).to.deep.equal([EVENT_ID]);
  });

  it("clears the cache when an event is cancelled, so it leaves the public catalogue", async () => {
    const { service, cache } = build([makeEvent({ id: EVENT_ID, createdBy: ORGANISER_ID })]);

    await service.deleteEvent(EVENT_ID, ORGANISER_ID);
    await settle();

    expect(cache.invalidated).to.deep.equal([EVENT_ID]);
  });

  it("leaves the cache alone when the mutation was rejected", async () => {
    const { service, cache } = build([makeEvent({ id: EVENT_ID, createdBy: ORGANISER_ID })]);

    try {
      await service.updateEvent(EVENT_ID, ATTACKER_ID, { name: "Renamed" });
      expect.fail("expected updateEvent to reject a non-owner");
    } catch {
      // asserted in the authorisation suite above
    }
    await settle();

    expect(cache.invalidated).to.deep.equal([]);
  });

  // The write is already durable when this runs, so a cache that cannot be reached must not turn a
  // successful publish into a failed request. The queued job and the TTL both still cover it.
  it("still returns the event when the cache cannot be cleared", async () => {
    const repository = new FakeEventRepository([]);
    const unreachable = new FakeEventCache();
    unreachable.invalidateEvent = async () => {
      throw new Error("Redis unreachable");
    };
    const service = new EventService(
      repository,
      new FakeEventInventoryRepository(),
      async (work) => work({} as never),
      unreachable,
    );

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);
    await settle();

    expect(event.status).to.equal("published");
  });
});
