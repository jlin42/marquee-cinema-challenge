import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, films, holds, locations, screens, showings } from "@/db/schema";

const seatsLeft = sql<number>`(
  SELECT count(*)::int FROM showing_seats ss
   WHERE ss.showing_id = ${showings.id}
     AND (ss.status = 'available' OR (ss.status = 'held' AND ss.hold_expires_at <= now()))
)`;
const totalSeats = sql<number>`(
  SELECT count(*)::int FROM showing_seats ss WHERE ss.showing_id = ${showings.id}
)`;

const showingFields = {
  id: showings.id,
  startsAt: showings.startsAt,
  film: { id: films.id, title: films.title, rating: films.rating, runtimeMinutes: films.runtimeMinutes },
  screen: { id: screens.id, name: screens.name },
  location: { id: locations.id, name: locations.name, city: locations.city },
  seatsLeft,
  totalSeats,
};

function baseQuery() {
  return db
    .select(showingFields)
    .from(showings)
    .innerJoin(films, eq(films.id, showings.filmId))
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .innerJoin(locations, eq(locations.id, screens.locationId));
}

export type ShowingSummary = Awaited<ReturnType<typeof listUpcomingShowings>>[number];

/** Showings that haven't started yet, grouped naturally by location then time. */
export async function listUpcomingShowings(locationId?: string) {
  return baseQuery()
    .where(
      and(gt(showings.startsAt, sql`now()`), locationId ? eq(locations.id, locationId) : undefined),
    )
    .orderBy(asc(locations.name), asc(showings.startsAt), asc(screens.name));
}

export async function getShowing(id: string) {
  const [row] = await baseQuery().where(eq(showings.id, id));
  return row ?? null;
}

/** The caller's unexpired, unconfirmed hold for a showing, if any. */
export async function getActiveHold(showingId: string, sessionId: string) {
  const [hold] = await db
    .select({ id: holds.id, seatIds: holds.seatIds, expiresAt: holds.expiresAt })
    .from(holds)
    .leftJoin(bookings, eq(bookings.holdId, holds.id))
    .where(
      and(
        eq(holds.showingId, showingId),
        eq(holds.sessionId, sessionId),
        gt(holds.expiresAt, sql`now()`),
        isNull(bookings.id),
      ),
    )
    .orderBy(desc(holds.createdAt))
    .limit(1);
  return hold ?? null;
}
