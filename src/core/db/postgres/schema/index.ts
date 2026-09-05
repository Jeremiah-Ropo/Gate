import { relations } from "drizzle-orm";

import { checkInDevices } from "./check-in-device.schema";
import { checkIns } from "./check-in.schema";
import { eventInventory } from "./event-inventory.schema";
import { eventMembers } from "./event-member.schema";
import { events } from "./event.schema";
import { ticketReservations } from "./ticket-reservation.schema";
import { tickets } from "./ticket.schema";
import { users } from "./user.schema";

export * from "./enums.schema";
export * from "./user.schema";
export * from "./event.schema";
export * from "./event-inventory.schema";
export * from "./event-member.schema";
export * from "./ticket.schema";
export * from "./ticket-reservation.schema";
export * from "./check-in-device.schema";
export * from "./check-in.schema";

export const usersRelations = relations(users, ({ many }) => ({
  events: many(events),
  tickets: many(tickets),
  ticketReservations: many(ticketReservations),
  eventMemberships: many(eventMembers),
  checkInsScanned: many(checkIns),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  createdByUser: one(users, { fields: [events.createdBy], references: [users.id] }),
  inventory: one(eventInventory, { fields: [events.id], references: [eventInventory.eventId] }),
  tickets: many(tickets),
  ticketReservations: many(ticketReservations),
  checkInDevices: many(checkInDevices),
  members: many(eventMembers),
  checkIns: many(checkIns),
}));

export const eventMembersRelations = relations(eventMembers, ({ one }) => ({
  event: one(events, { fields: [eventMembers.eventId], references: [events.id] }),
  user: one(users, { fields: [eventMembers.userId], references: [users.id] }),
}));

export const eventInventoryRelations = relations(eventInventory, ({ one }) => ({
  event: one(events, { fields: [eventInventory.eventId], references: [events.id] }),
}));

export const ticketReservationsRelations = relations(ticketReservations, ({ one }) => ({
  user: one(users, { fields: [ticketReservations.userId], references: [users.id] }),
  event: one(events, { fields: [ticketReservations.eventId], references: [events.id] }),
  ticket: one(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  event: one(events, { fields: [tickets.eventId], references: [events.id] }),
  owner: one(users, { fields: [tickets.ownerId], references: [users.id] }),
  reservation: one(ticketReservations, {
    fields: [tickets.reservationId],
    references: [ticketReservations.id],
  }),
  checkIns: many(checkIns),
}));

export const checkInDevicesRelations = relations(checkInDevices, ({ one, many }) => ({
  event: one(events, { fields: [checkInDevices.eventId], references: [events.id] }),
  checkIns: many(checkIns),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  ticket: one(tickets, { fields: [checkIns.ticketId], references: [tickets.id] }),
  event: one(events, { fields: [checkIns.eventId], references: [events.id] }),
  device: one(checkInDevices, { fields: [checkIns.deviceId], references: [checkInDevices.id] }),
  scannedByUser: one(users, { fields: [checkIns.scannedBy], references: [users.id] }),
}));
