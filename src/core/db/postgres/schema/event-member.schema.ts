import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { eventMemberRoleEnum, membershipStatusEnum } from "./enums.schema";
import { events } from "./event.schema";
import { users } from "./user.schema";

// Who is allowed to work an event, and in what capacity. A door device is not a registered
// piece of hardware; it is a logged-in user an organizer has put on this event's door.
//
// An organizer adds staff directly and the membership is usable immediately. There is no
// invite to accept: working a door is a shift assignment, and the system gains nothing by
// asking permission it would not honour a refusal of.
export const eventMembers = pgTable(
  "event_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: eventMemberRoleEnum("role").notNull().default("door_staff"),
    status: membershipStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One membership per person per event; re-adding reactivates the existing row.
    uniqueIndex("event_members_event_user_unique").on(table.eventId, table.userId),
    // Serves "who may open a session for this event" and the /my-events listing.
    index("event_members_event_status_idx").on(table.eventId, table.status),
    index("event_members_user_status_idx").on(table.userId, table.status),
  ],
);

export type EventMember = typeof eventMembers.$inferSelect;
export type NewEventMember = typeof eventMembers.$inferInsert;
