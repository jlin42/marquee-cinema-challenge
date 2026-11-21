CREATE TYPE "public"."booking_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."staff_action_type" AS ENUM('booking.cancel', 'booking.move', 'staff.role_change', 'staff.deactivate', 'staff.activate');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('admin', 'privileged', 'viewer');--> statement-breakpoint
CREATE TABLE "staff_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"action" "staff_action_type" NOT NULL,
	"booking_id" uuid,
	"target_staff_user_id" uuid,
	"summary" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "staff_role" DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "booking_seats_showing_seat_uq";--> statement-breakpoint
ALTER TABLE "booking_seats" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "status" "booking_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_actions" ADD CONSTRAINT "staff_actions_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_actions" ADD CONSTRAINT "staff_actions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_actions" ADD CONSTRAINT "staff_actions_target_staff_user_id_staff_users_id_fk" FOREIGN KEY ("target_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_actions_user_created_idx" ON "staff_actions" USING btree ("staff_user_id","created_at");--> statement-breakpoint
CREATE INDEX "staff_actions_created_idx" ON "staff_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "staff_sessions_user_idx" ON "staff_sessions" USING btree ("staff_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_users_username_ci_uq" ON "staff_users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "booking_seats_active_showing_seat_uq" ON "booking_seats" USING btree ("showing_id","seat_id") WHERE "booking_seats"."released_at" IS NULL;