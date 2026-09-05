import { CustomError } from "core/global/errors";
import eventInventoryReader from "../repository/event-inventory.reader";
import eventRepository from "../repository/event.repository";
import { IEventInventoryReader } from "../entity/event-inventory.interface";
import {
  IConsoleEventRow,
  IEventProjectionService,
  IEventRepository,
  IPublishedEventProjection,
} from "../entity/event.interface";
import { toConsoleRow, toDescriptor, toProjection } from "../entity/event.view";

/**
 * The read model for events — the surface other slices consume.
 *
 * Event fields come from Postgres; capacity and the counters are read from Inventory and merged in
 * per request. Caching is added on top of this in a follow-up, over the event fields only: the
 * counters move on claims, which happen in another slice and give this one no invalidation signal.
 *
 * Collaborators arrive through the constructor rather than being imported at module scope, so the
 * read paths can be exercised against fakes with no Postgres or Inventory present. The wired
 * singleton is the default export, matching how every other service here is consumed.
 */
export class EventProjectionService implements IEventProjectionService {
  constructor(private readonly repository: IEventRepository, private readonly inventory: IEventInventoryReader) {}

  async listPublished(): Promise<IPublishedEventProjection[]> {
    const events = await this.repository.listPublished();
    const snapshots = await this.inventory.findByEventIds(events.map((event) => event.id));
    return events.map((event) => toProjection(toDescriptor(event), snapshots.get(event.id) ?? null));
  }

  async getPublishedById(id: string): Promise<IPublishedEventProjection> {
    const event = await this.repository.findPublishedById(id);
    if (!event) {
      throw new CustomError(404, "NotFound", "Event not found");
    }
    return toProjection(toDescriptor(event), await this.inventory.findByEventId(id));
  }

  /** Console rows include drafts, which never belong in the public catalogue. */
  async listForOrganiser(organiserId: string): Promise<IConsoleEventRow[]> {
    const events = await this.repository.listByOrganiser(organiserId);
    const snapshots = await this.inventory.findByEventIds(events.map((event) => event.id));
    return events.map((event) => toConsoleRow(event, snapshots.get(event.id) ?? null));
  }
}

export default new EventProjectionService(eventRepository, eventInventoryReader);
