import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { userRoleEnum } from "./enums.schema";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phoneNumber: varchar("phone_number", { length: 32 }),
  password: varchar("password", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("attendee"),
  profilePicture: varchar("profile_picture", { length: 512 }),
  isVerified: boolean("is_verified").notNull().default(false),
  refreshToken: varchar("refresh_token", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
