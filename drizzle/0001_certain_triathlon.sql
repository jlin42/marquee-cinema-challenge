ALTER TABLE "films" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "genre" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "synopsis" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "backdrop_url" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "featured_rank" integer;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_slug_unique" UNIQUE("slug");