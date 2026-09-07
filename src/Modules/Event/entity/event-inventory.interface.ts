import type { DbTransaction } from "core/db/postgres";
import { EventInventory, NewEventInventory } from "./event-inventory.model";

export interface IEventInventoryRepository {
  withTx(tx: DbTransaction): IEventInventoryRepository;
  create(data: NewEventInventory): Promise<EventInventory>;
  findByEventId(eventId: string): Promise<EventInventory | null>;
  reserveTicket(eventId: string): Promise<EventInventory | null>;
  sellReservedTicket(eventId: string): Promise<EventInventory | null>;
  releaseReservedTicket(eventId: string): Promise<EventInventory | null>;
  setCapacity(eventId: string, capacity: number): Promise<EventInventory | null>;
}
