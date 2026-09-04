import { IEventCache, IPublishedEventDescriptor } from "Modules/Event/entity/event.interface";

/**
 * In-memory cache honouring the same contract as the Redis one: reads return null on a miss and
 * never throw. `alwaysMiss` simulates Redis being unavailable, which the real implementation
 * reports as a miss so reads fall through to Postgres.
 */
export class FakeEventCache implements IEventCache {
  public writes = 0;
  private descriptors = new Map<string, IPublishedEventDescriptor>();
  private list: IPublishedEventDescriptor[] | null = null;

  constructor(private readonly alwaysMiss = false) {}

  async getDescriptor(eventId: string): Promise<IPublishedEventDescriptor | null> {
    return this.alwaysMiss ? null : this.descriptors.get(eventId) ?? null;
  }

  async setDescriptor(descriptor: IPublishedEventDescriptor): Promise<void> {
    this.writes += 1;
    this.descriptors.set(descriptor.id, descriptor);
  }

  async getPublishedList(): Promise<IPublishedEventDescriptor[] | null> {
    return this.alwaysMiss ? null : this.list;
  }

  async setPublishedList(descriptors: IPublishedEventDescriptor[]): Promise<void> {
    this.writes += 1;
    this.list = descriptors;
  }

  async invalidateEvent(eventId: string): Promise<void> {
    this.descriptors.delete(eventId);
    this.list = null;
  }
}
