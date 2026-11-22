CREATE TABLE "discount_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"percent_off" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"max_redemptions" integer,
	"redemptions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "confirmation_code" text DEFAULT 'MQ' || upper(substr(md5(gen_random_uuid()::text), 1, 8)) NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_discount_code_discount_codes_code_fk" FOREIGN KEY ("discount_code") REFERENCES "public"."discount_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_confirmation_code_unique" UNIQUE("confirmation_code");