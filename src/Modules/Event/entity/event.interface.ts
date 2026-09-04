import { EEventStatus } from "core/global/entities/enums";
import { Event, NewEvent } from "./event.model";

export interface ICreateEventDTO {
  name: string;
  description?: string;
  venue?: string;
  address?: string;
  startsAt: string;
  ticketPrice: number;
  currency?: string;
}

export interface IPublishEventDTO {
  name: string;
  description?: string;
  venue?: string;
  address?: string;
  startsAt: string;
  // The fixed ticket count the event is published with. Becomes events_inventory.capacity.
  capacity: number;
  ticketPrice?: number;
  currency?: string;
}

export interface IUpdateEventDTO {
  name?: string;
  description?: string;
  venue?: string;
  address?: string;
  coverImage?: string;
  startsAt?: string;
  ticketPrice?: number;
  status?: EEventStatus;
}

/**
 * The event-owned half of the projection. Only Events mutates these fields, which is what will make
 * them safe to cache: every value here is invalidated by a committed event mutation. Nothing from
 * events_inventory belongs in here.
 */
export interface IPublishedEventDescriptor {
  id: string;
  name: string;
  description: string | null;
  venue: string | null;
  startsAt: Date;
}

/**
 * The published-event projection — the contract the Public browse slice consumes.
 *
 * Stock figures come from Inventory and are read live. `null` means Inventory could not be read;
 * it does not mean zero.
 */
export interface IPublishedEventProjection extends IPublishedEventDescriptor {
  capacity: number | null;
  reserved: number | null;
  remaining: number | null;
  sold: number | null;
}

/** Console row: the projection plus the states an organiser needs, drafts included. */
export interface IConsoleEventRow extends IPublishedEventProjection {
  status: string;
}

/** Read model. This is the surface other slices are allowed to depend on. */
export interface IEventProjectionService {
  listPublished(): Promise<IPublishedEventProjection[]>;
  getPublishedById(id: string): Promise<IPublishedEventProjection>;
  listForOrganiser(organiserId: string): Promise<IConsoleEventRow[]>;
}

export interface IEventService {
  createEvent(createdBy: string, payload: ICreateEventDTO): Promise<Event>;
  publishEvent(createdBy: string, payload: IPublishEventDTO): Promise<Event>;
  getById(id: string): Promise<Event>;
  list(): Promise<Event[]>;
  updateEvent(id: string, requesterId: string, payload: IUpdateEventDTO): Promise<Event>;
  uploadCoverImage(id: string, requesterId: string, tempFilePath: string): Promise<Event>;
}

export interface IEventRepository {
  create(data: NewEvent): Promise<Event>;
  /**
   * Inserts the event and its inventory row in one transaction. Inventory's schema requires the row
   * to exist from the moment the event does, and it exposes no method for us to call — so this is
   * the single place Events writes that table, and the seam to replace if Inventory takes it over.
   */
  createPublishedWithInventory(data: NewEvent, capacity: number): Promise<Event>;
  findById(id: string): Promise<Event | null>;
  findBySlug(slug: string): Promise<Event | null>;
  list(): Promise<Event[]>;
  listPublished(): Promise<Event[]>;
  findPublishedById(id: string): Promise<Event | null>;
  listByOrganiser(organiserId: string): Promise<Event[]>;
  update(id: string, data: Partial<NewEvent>): Promise<Event | null>;
}

/**
 * Cache-aside store for descriptors. Reads and writes degrade to a miss instead of throwing: a
 * Redis outage must slow browse down to a Postgres read, never fail it. Invalidation is the one
 * method allowed to throw, so the worker retries rather than leaving a stale entry.
 */
export interface IEventCache {
  getDescriptor(eventId: string): Promise<IPublishedEventDescriptor | null>;
  setDescriptor(descriptor: IPublishedEventDescriptor): Promise<void>;
  getPublishedList(): Promise<IPublishedEventDescriptor[] | null>;
  setPublishedList(descriptors: IPublishedEventDescriptor[]): Promise<void>;
  invalidateEvent(eventId: string): Promise<void>;
}
