import { relations } from "drizzle-orm";

import { checkInDevices } from "./check-in-device.schema";
import { checkIns } from "./check-in.schema";
import { events } from "./event.schema";
import { tickets } from "./ticket.schema";
import { users } from "./user.schema";

export * from "./enums.schema";
export * from "./user.schema";
export * from "./event.schema";
export * from "./ticket.schema";
export * from "./check-in-device.schema";
export * from "./check-in.schema";

export const usersRelations = relations(users, ({ many }) => ({
  events: many(events),
  tickets: many(tickets),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  createdByUser: one(users, { fields: [events.createdBy], references: [users.id] }),
  tickets: many(tickets),
  checkInDevices: many(checkInDevices),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  event: one(events, { fields: [tickets.eventId], references: [events.id] }),
  owner: one(users, { fields: [tickets.ownerId], references: [users.id] }),
  checkIns: many(checkIns),
}));

export const checkInDevicesRelations = relations(checkInDevices, ({ one, many }) => ({
  event: one(events, { fields: [checkInDevices.eventId], references: [events.id] }),
  checkIns: many(checkIns),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  ticket: one(tickets, { fields: [checkIns.ticketId], references: [tickets.id] }),
  device: one(checkInDevices, { fields: [checkIns.deviceId], references: [checkInDevices.id] }),
  scannedByUser: one(users, { fields: [checkIns.scannedBy], references: [users.id] }),
}));
