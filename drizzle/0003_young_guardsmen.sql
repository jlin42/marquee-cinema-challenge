CREATE TYPE "public"."ticket_type" AS ENUM('general', 'child', 'senior');--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"code" "ticket_type" PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_seats" ADD COLUMN "ticket_type" "ticket_type" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_seats" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_seats" ADD COLUMN "fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "total_cents" integer DEFAULT 0 NOT NULL;