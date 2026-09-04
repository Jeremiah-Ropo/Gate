import { CustomError } from "core/global/errors";
import eventInventoryReader from "../repository/event-inventory.reader";
import eventRepository from "../repository/event.repository";
import eventCache from "./event-cache";
import { IEventInventoryReader } from "../entity/event-inventory.interface";
import {
  IConsoleEventRow,
  IEventCache,
  IEventProjectionService,
  IEventRepository,
  IPublishedEventProjection,
} from "../entity/event.interface";
import { toConsoleRow, toDescriptor, toProjection } from "../entity/event.view";

/**
 * The read model for events — the surface other slices consume.
 *
 * Event fields are served cache-aside; capacity and the counters are read from Inventory live on
 * every request and merged in. Only the event fields are cached, because the counters move on
 * claims, which happen in another slice and give this one no invalidation signal. See
 * event-cache.ts for the full reasoning.
 *
 * Collaborators arrive through the constructor rather than being imported at module scope, so the
 * read paths can be exercised against fakes with no Postgres or Inventory present. The wired
 * singleton is the default export, matching how every other service here is consumed.
 */
export class EventProjectionService implements IEventProjectionService {
  constructor(
    private readonly repository: IEventRepository,
    private readonly inventory: IEventInventoryReader,
    private readonly cache: IEventCache,
  ) {}

  async listPublished(): Promise<IPublishedEventProjection[]> {
    let descriptors = await this.cache.getPublishedList();
    if (!descriptors) {
      descriptors = (await this.repository.listPublished()).map(toDescriptor);
      await this.cache.setPublishedList(descriptors);
    }

    const snapshots = await this.inventory.findByEventIds(descriptors.map((descriptor) => descriptor.id));
    return descriptors.map((descriptor) => toProjection(descriptor, snapshots.get(descriptor.id) ?? null));
  }

  async getPublishedById(id: string): Promise<IPublishedEventProjection> {
    let descriptor = await this.cache.getDescriptor(id);
    if (!descriptor) {
      const event = await this.repository.findPublishedById(id);
      if (!event) {
        throw new CustomError(404, "NotFound", "Event not found");
      }
      descriptor = toDescriptor(event);
      await this.cache.setDescriptor(descriptor);
    }

    return toProjection(descriptor, await this.inventory.findByEventId(id));
  }

  /**
   * Console reads bypass the cache: an organiser needs current truth, and this includes drafts,
   * which never belong in the published cache in the first place.
   */
  async listForOrganiser(organiserId: string): Promise<IConsoleEventRow[]> {
    const events = await this.repository.listByOrganiser(organiserId);
    const snapshots = await this.inventory.findByEventIds(events.map((event) => event.id));
    return events.map((event) => toConsoleRow(event, snapshots.get(event.id) ?? null));
  }
}

export default new EventProjectionService(eventRepository, eventInventoryReader, eventCache);
