CREATE TYPE "public"."payment_attempt_status" AS ENUM('processing', 'succeeded', 'failed');--> statement-breakpoint
ALTER TYPE "public"."reservation_status" ADD VALUE 'payment_processing' BEFORE 'paid';--> statement-breakpoint
CREATE TABLE "reservation_payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"reference" varchar(255) NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_payment_attempts_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD COLUMN "latest_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD COLUMN "payment_processing_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservation_payment_attempts" ADD CONSTRAINT "reservation_payment_attempts_reservation_id_ticket_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."ticket_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_payment_attempts_one_processing" ON "reservation_payment_attempts" USING btree ("reservation_id") WHERE "reservation_payment_attempts"."status" = 'processing';