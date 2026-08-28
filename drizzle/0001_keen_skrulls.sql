CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'paid', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "events_inventory" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"remaining" integer DEFAULT 0 NOT NULL,
	"sold" integer DEFAULT 0 NOT NULL,
	"capacity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_inventory_reserved_non_negative" CHECK ("events_inventory"."reserved" >= 0),
	CONSTRAINT "events_inventory_remaining_non_negative" CHECK ("events_inventory"."remaining" >= 0),
	CONSTRAINT "events_inventory_sold_non_negative" CHECK ("events_inventory"."sold" >= 0),
	CONSTRAINT "events_inventory_capacity_non_negative" CHECK ("events_inventory"."capacity" >= 0),
	CONSTRAINT "events_inventory_balanced" CHECK ("events_inventory"."reserved" + "events_inventory"."remaining" + "events_inventory"."sold" = "events_inventory"."capacity")
);
--> statement-breakpoint
CREATE TABLE "ticket_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "reservation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "password" TO "password_hash";--> statement-breakpoint
ALTER TABLE "events" RENAME COLUMN "ticket_price" TO "ticket_price_naira";--> statement-breakpoint
ALTER TABLE "tickets" RENAME COLUMN "qr_code_url" TO "qr_payload";--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_code_unique";--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'valid'::text;--> statement-breakpoint
DROP TYPE "public"."ticket_status";--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('valid', 'void', 'refunded');--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'valid'::"public"."ticket_status";--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "status" SET DATA TYPE "public"."ticket_status" USING "status"::"public"."ticket_status";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "currency" SET DATA TYPE varchar(3);--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "currency" SET DEFAULT 'NGN';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "starts_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "reservation_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "events_inventory" ADD CONSTRAINT "events_inventory_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reservation_id_ticket_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."ticket_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "profile_picture";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "timezone";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "start_date";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "end_date";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "capacity";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "owner_name";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "owner_email";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "code";--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reservation_id_unique" UNIQUE("reservation_id");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_qr_payload_unique" UNIQUE("qr_payload");