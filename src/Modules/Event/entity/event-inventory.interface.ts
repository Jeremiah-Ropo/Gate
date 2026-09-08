import type { DbTransaction } from "core/db/postgres";
import { EventInventory, NewEventInventory } from "./event-inventory.model";

export interface IEventInventoryRepository {
  withTx(tx: DbTransaction): IEventInventoryRepository;
  create(data: NewEventInventory): Promise<EventInventory>;
  findByEventId(eventId: string): Promise<EventInventory | null>;
  /**
   * Added for the published-event read model: the catalogue projects many events at once, and
   * calling findByEventId per row would put an inventory query behind every listed event.
   * Shared dependency — flagged for Inventory's review.
   */
  findByEventIds(eventIds: string[]): Promise<Map<string, EventInventory>>;
  reserveTicket(eventId: string): Promise<EventInventory | null>;
  sellReservedTicket(eventId: string): Promise<EventInventory | null>;
  releaseReservedTickets(eventId: string, quantity: number): Promise<EventInventory | null>;
  releaseReservedTicket(eventId: string): Promise<EventInventory | null>;
  setCapacity(eventId: string, capacity: number): Promise<EventInventory | null>;
}
