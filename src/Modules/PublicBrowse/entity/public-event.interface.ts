import type { IPublishedEventProjection } from "Modules/Event";

export interface IPublicEvent {
  id: string;
  name: string;
  description: string | null;
  venue: string | null;
  address: string | null;
  coverImage: string | null;
  startsAt: string;
  ticketPrice: number;
  currency: string;
  capacity: number | null;
  remaining: number | null;
}

export interface IPublicBrowseService {
  getPublishedEvents(): Promise<IPublicEvent[]>;
  getByIdEventDetails(eventId: string): Promise<IPublicEvent>;
}

export const toPublicEvent = (projection: IPublishedEventProjection): IPublicEvent => ({
  id: projection.id,
  name: projection.name,
  description: projection.description,
  venue: projection.venue,
  address: projection.address,
  coverImage: projection.coverImage,
  startsAt: projection.startsAt.toISOString(),
  ticketPrice: projection.ticketPrice,
  currency: projection.currency,
  capacity: projection.capacity,
  remaining: projection.remaining,
});
