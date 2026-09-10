import * as api from "@/lib/api";
import type { EventPayload } from "@/lib/api";
import type { CheckIn, DoorEvent, EventStatus, GateEvent, GateTicket } from "@/types";

export interface GateClient {
  listEvents(): Promise<GateEvent[]>;
  getEvent(eventId: string): Promise<GateEvent>;
  getReservation(id: string): ReturnType<typeof api.getReservation>;
  createReservation(eventId: string, idempotencyKey: string): ReturnType<typeof api.createReservation>;
  payReservation(id: string, outcome: api.DemoPaymentOutcome): ReturnType<typeof api.payReservation>;
  cancelReservation(id: string): ReturnType<typeof api.cancelReservation>;
  listMyTickets(): Promise<GateTicket[]>;
  getTicket(ticketId: string): Promise<GateTicket>;
  voidTicket(ticketId: string): Promise<GateTicket>;
  createEvent(payload: EventPayload): Promise<GateEvent>;
  updateEvent(eventId: string, payload: Partial<EventPayload> & { status?: EventStatus }): Promise<GateEvent>;
  getManagedEvent(eventId: string): Promise<GateEvent>;
  listManagedEvents(): Promise<GateEvent[]>;
  listMyDoorEvents(): Promise<DoorEvent[]>;
  getCheckInsForTicket(ticketId: string): Promise<CheckIn[]>;
}

const realClient: GateClient = {
  listEvents: api.listEvents,
  getEvent: api.getEvent,
  getReservation: api.getReservation,
  createReservation: api.createReservation,
  payReservation: api.payReservation,
  cancelReservation: api.cancelReservation,
  listMyTickets: api.listMyTickets,
  getTicket: api.getTicket,
  voidTicket: api.voidTicket,
  createEvent: api.createEvent,
  updateEvent: api.updateEvent,
  getManagedEvent: api.getManagedEvent,
  listManagedEvents: api.listManagedEvents,
  listMyDoorEvents: api.listMyDoorEvents,
  getCheckInsForTicket: api.getCheckInsForTicket,
};

export function useGateClient(): GateClient {
  return realClient;
}
