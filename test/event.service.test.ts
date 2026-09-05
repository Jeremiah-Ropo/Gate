import { expect } from "chai";

import { EventService } from "Modules/Event/service/event.service";
import { FakeEventRepository, makeEvent } from "./helpers/fake-event.repository";

const ORGANISER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const publishPayload = {
  name: "Lagos Tech Summit",
  startsAt: "2026-03-01T09:00:00.000Z",
  capacity: 250,
};

describe("EventService.publishEvent", () => {
  it("creates the event already published", async () => {
    const repository = new FakeEventRepository([]);
    const service = new EventService(repository);

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);

    expect(event.status).to.equal("published");
    expect(event.createdBy).to.equal(ORGANISER_ID);
    expect(event.starts_at.toISOString()).to.equal("2026-03-01T09:00:00.000Z");
  });

  it("creates the inventory row with the ticket count, through the transactional path", async () => {
    const repository = new FakeEventRepository([]);
    const service = new EventService(repository);

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);

    // Inventory's schema requires the row to exist from the moment the event does, so publish must
    // go through createPublishedWithInventory rather than a plain insert.
    expect(repository.inventoryWrites).to.deep.equal([{ eventId: event.id, capacity: 250 }]);
  });

  it("defaults ticket price to zero, since payments belong to another slice", async () => {
    const repository = new FakeEventRepository([]);
    const service = new EventService(repository);

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);

    expect(event.ticketPrice).to.equal(0);
  });

  it("gives a clashing name a unique slug rather than failing on the unique index", async () => {
    const repository = new FakeEventRepository([makeEvent({ slug: "lagos-tech-summit" })]);
    const service = new EventService(repository);

    const event = await service.publishEvent(ORGANISER_ID, publishPayload);

    expect(event.slug).to.not.equal("lagos-tech-summit");
    expect(event.slug).to.match(/^lagos-tech-summit-[0-9a-f]{6}$/);
  });
});
