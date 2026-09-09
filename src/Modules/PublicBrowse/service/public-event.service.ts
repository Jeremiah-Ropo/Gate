import { Service } from "typedi";

import { eventProjectionService } from "Modules/Event";
import { IPublicBrowseService, IPublicEvent, toPublicEvent } from "../entity/public-event.interface";

// ADR 0010: this slice owns the anonymous route surface, not a second cache. Events &
// Console already serves a cache-aside, invalidation-backed read model (ADR 0004) behind
// `eventProjectionService`; duplicating that here would mean two caches disagreeing about
// the same event, and reading Postgres/Redis directly from this module would break exactly
// the module boundary that keeps browse traffic off the write-hot tables. So this service
// does nothing but call through and reshape the response — see the interface for what's
// trimmed and why (reserved/sold, Inventory's internal bookkeeping).
@Service()
class PublicBrowseService implements IPublicBrowseService {
  private static instance: IPublicBrowseService;
  private readonly projection = eventProjectionService;

  public static getInstance(): IPublicBrowseService {
    if (!this.instance) {
      this.instance = new PublicBrowseService();
    }
    return this.instance;
  }

  async getPublishedEvents(): Promise<IPublicEvent[]> {
    const projections = await this.projection.listPublished();
    return projections.map(toPublicEvent);
  }

  async getByIdEventDetails(eventId: string): Promise<IPublicEvent> {
    // getPublishedById already throws a 404 CustomError for a draft/cancelled/nonexistent
    // id — an unpublished event is indistinguishable from a missing one, by design.
    const projection = await this.projection.getPublishedById(eventId);
    return toPublicEvent(projection);
  }
}

export default PublicBrowseService.getInstance();
