import { useMemo } from "react";

import * as api from "@/lib/api";
import type { EventPayload } from "@/lib/api";
import * as previewApi from "@/lib/previewClient";
import { useAuth } from "@/context/AuthContext";
import type { CheckIn, CheckInDevice, EventStatus, GateEvent, GateTicket } from "@/types";

export interface GateClient {
  listEvents(): Promise<GateEvent[]>;
  getEvent(eventId: string): Promise<GateEvent>;
  claimTicket(eventId: string): Promise<GateTicket>;
  listMyTickets(): Promise<GateTicket[]>;
  getTicket(ticketId: string): Promise<GateTicket>;
  voidTicket(ticketId: string): Promise<GateTicket>;
  createEvent(payload: EventPayload): Promise<GateEvent>;
  updateEvent(eventId: string, payload: Partial<EventPayload> & { status?: EventStatus }): Promise<GateEvent>;
  listCheckInDevices(eventId: string): Promise<CheckInDevice[]>;
  registerCheckInDevice(payload: {
    eventId: string;
    name: string;
    location?: string;
  }): Promise<{ device: CheckInDevice; deviceSecret: string }>;
  deactivateCheckInDevice(deviceId: string): Promise<CheckInDevice>;
  getCheckInsForTicket(ticketId: string): Promise<CheckIn[]>;
}

const realClient: GateClient = {
  listEvents: api.listEvents,
  getEvent: api.getEvent,
  claimTicket: api.claimTicket,
  listMyTickets: api.listMyTickets,
  getTicket: api.getTicket,
  voidTicket: api.voidTicket,
  createEvent: api.createEvent,
  updateEvent: api.updateEvent,
  listCheckInDevices: api.listCheckInDevices,
  registerCheckInDevice: api.registerCheckInDevice,
  deactivateCheckInDevice: api.deactivateCheckInDevice,
  getCheckInsForTicket: api.getCheckInsForTicket,
};

// Every data-fetching page calls this instead of importing api.ts directly, so a preview
// session (see lib/previewSession) transparently reads/writes the local preview store
// instead of the network — same call sites, no branching in the pages themselves.
export function useGateClient(): GateClient {
  const { user, isPreview } = useAuth();

  return useMemo<GateClient>(() => {
    if (!isPreview || !user) return realClient;

    const ownerId = user.id;
    return {
      listEvents: previewApi.listEvents,
      getEvent: previewApi.getEvent,
      claimTicket: (eventId) => previewApi.claimTicket(eventId, ownerId),
      listMyTickets: () => previewApi.listMyTickets(ownerId),
      getTicket: previewApi.getTicket,
      voidTicket: previewApi.voidTicket,
      createEvent: (payload) => previewApi.createEvent(payload, ownerId),
      updateEvent: previewApi.updateEvent,
      listCheckInDevices: previewApi.listCheckInDevices,
      registerCheckInDevice: previewApi.registerCheckInDevice,
      deactivateCheckInDevice: previewApi.deactivateCheckInDevice,
      getCheckInsForTicket: previewApi.getCheckInsForTicket,
    };
  }, [isPreview, user]);
}
