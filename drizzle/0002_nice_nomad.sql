CREATE TYPE "public"."event_member_role" AS ENUM('door_staff', 'organizer');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "event_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "event_member_role" DEFAULT 'door_staff' NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "scanned_code" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "device_id" DROP NOT NULL;--> statement-breakpoint
--> Hand-edited: drizzle-kit emitted `ADD COLUMN "event_id" uuid NOT NULL`, which aborts on
--> any non-empty check_ins table. Added nullable, backfilled, then constrained. The end
--> state is identical to the generated snapshot.
ALTER TABLE "check_ins" ADD COLUMN "event_id" uuid;--> statement-breakpoint
--> Preferred source: the scan's own ticket.
UPDATE "check_ins" SET "event_id" = t."event_id" FROM "tickets" t WHERE t."id" = "check_ins"."ticket_id" AND "check_ins"."event_id" IS NULL;--> statement-breakpoint
--> Fallback for scans of unrecognized codes, which have no ticket to join through. Every
--> pre-existing row has a device, because device_id was NOT NULL until this migration.
UPDATE "check_ins" SET "event_id" = d."event_id" FROM "check_in_devices" d WHERE d."id" = "check_ins"."device_id" AND "check_ins"."event_id" IS NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "event_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_members_event_user_unique" ON "event_members" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_members_event_status_idx" ON "event_members" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "event_members_user_status_idx" ON "event_members" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "check_ins_one_success_per_ticket" ON "check_ins" USING btree ("ticket_id") WHERE "check_ins"."status" = 'success';--> statement-breakpoint
CREATE INDEX "check_ins_event_status_idx" ON "check_ins" USING btree ("event_id","status");