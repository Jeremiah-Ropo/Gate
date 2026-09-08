CREATE TYPE "public"."stub_payment_status" AS ENUM('processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "stub_payment_requests" (
	"reference" varchar(255) PRIMARY KEY NOT NULL,
	"status" "stub_payment_status" NOT NULL,
	"failure_reason" text,
	"completes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservation_payment_attempts" ADD COLUMN "recovery_claim_id" uuid;--> statement-breakpoint
ALTER TABLE "reservation_payment_attempts" ADD COLUMN "recovery_claimed_until" timestamp with time zone;