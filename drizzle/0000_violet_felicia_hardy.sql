CREATE TYPE "public"."seat_status" AS ENUM('available', 'held', 'booked');--> statement-breakpoint
CREATE TYPE "public"."seat_type" AS ENUM('standard', 'wheelchair', 'companion');--> statement-breakpoint
CREATE TABLE "booking_seats" (
	"booking_id" uuid NOT NULL,
	"showing_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"showing_id" uuid NOT NULL,
	"hold_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_hold_id_unique" UNIQUE("hold_id")
);
--> statement-breakpoint
CREATE TABLE "films" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"runtime_minutes" integer NOT NULL,
	"rating" text
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"showing_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"seat_ids" uuid[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screen_id" uuid NOT NULL,
	"row_label" text NOT NULL,
	"number" integer NOT NULL,
	"type" "seat_type" DEFAULT 'standard' NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showing_seats" (
	"showing_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"status" "seat_status" DEFAULT 'available' NOT NULL,
	"hold_id" uuid,
	"hold_expires_at" timestamp with time zone,
	"booking_id" uuid,
	CONSTRAINT "showing_seats_showing_id_seat_id_pk" PRIMARY KEY("showing_id","seat_id")
);
--> statement-breakpoint
CREATE TABLE "showings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screen_id" uuid NOT NULL,
	"film_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_showing_id_showings_id_fk" FOREIGN KEY ("showing_id") REFERENCES "public"."showings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_showing_id_showings_id_fk" FOREIGN KEY ("showing_id") REFERENCES "public"."showings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_showing_id_showings_id_fk" FOREIGN KEY ("showing_id") REFERENCES "public"."showings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screens" ADD CONSTRAINT "screens_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_screen_id_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."screens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showing_seats" ADD CONSTRAINT "showing_seats_showing_id_showings_id_fk" FOREIGN KEY ("showing_id") REFERENCES "public"."showings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showing_seats" ADD CONSTRAINT "showing_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showing_seats" ADD CONSTRAINT "showing_seats_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showing_seats" ADD CONSTRAINT "showing_seats_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_screen_id_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."screens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_seats_showing_seat_uq" ON "booking_seats" USING btree ("showing_id","seat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seats_screen_row_number_uq" ON "seats" USING btree ("screen_id","row_label","number");--> statement-breakpoint
CREATE INDEX "showing_seats_hold_id_idx" ON "showing_seats" USING btree ("hold_id");--> statement-breakpoint
CREATE INDEX "showings_starts_at_idx" ON "showings" USING btree ("starts_at");