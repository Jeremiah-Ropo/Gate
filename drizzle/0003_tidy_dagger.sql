--> Hand-edited. drizzle-kit emitted DROP TABLE "check_in_devices" CASCADE followed by an
--> ALTER TABLE ... DROP CONSTRAINT for the foreign key CASCADE had already removed, which
--> errors. Reordered so each statement is valid on its own: dropping check_ins.device_id
--> removes the only dependency, so the table then drops without CASCADE.

--> Pre-existing scans recorded which device scanned, never which person, and there is no
--> honest way to attribute them to a user now. Backfilling from the event creator was
--> rejected: this table is an audit log, and a wrong name in an audit log is worse than a
--> missing row. They are dev-stage rows referencing a table this migration drops.
DELETE FROM "check_ins" WHERE "scanned_by" IS NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "scanned_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" DROP COLUMN "device_id";--> statement-breakpoint
DROP TABLE "check_in_devices";
