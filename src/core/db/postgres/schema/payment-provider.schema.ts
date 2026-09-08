import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { stubPaymentStatusEnum } from "./enums.schema";

// This is the durable backing store for the local payment-provider stub. The
// reservation module talks to it only through IPaymentProvider.
export const stubPaymentRequests = pgTable("stub_payment_requests", {
  reference: varchar("reference", { length: 255 }).primaryKey(),
  status: stubPaymentStatusEnum("status").notNull(),
  failureReason: text("failure_reason"),
  completesAt: timestamp("completes_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StubPaymentRequest = typeof stubPaymentRequests.$inferSelect;
export type NewStubPaymentRequest = typeof stubPaymentRequests.$inferInsert;
