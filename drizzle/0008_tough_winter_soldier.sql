CREATE TABLE "ip_blocks" (
	"ip" text PRIMARY KEY NOT NULL,
	"blocked_until" timestamp with time zone NOT NULL,
	"strikes" integer DEFAULT 1 NOT NULL,
	"last_blocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_counters" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "request_counters_key_window_start_pk" PRIMARY KEY("key","window_start")
);
