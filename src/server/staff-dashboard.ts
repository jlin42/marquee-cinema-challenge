/** Read-only queries for the staff dashboard. Access is checked by the caller's view model. */
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, bookingSeats, films, locations, screens, seats, showings } from "@/db/schema";
import { CINEMA_TIME_ZONE } from "@/lib/time";

export async function listAllLocations() {
  return db.select({ id: locations.id, name: locations.name }).from(locations).orderBy(asc(locations.name));
}

export async function listScreens(locationId: string) {
  return db
    .select({ id: screens.id, name: screens.name })
    .from(screens)
    .where(eq(screens.locationId, locationId))
    .orderBy(asc(screens.name));
}

/** Showings on one screen on a cinema-local date, with sold and total seat counts. */
export async function listScreenShowings(screenId: string, date: string) {
  return db
    .select({
      id: showings.id,
      startsAt: showings.startsAt,
      filmTitle: films.title,
      sold: sql<number>`(SELECT count(*)::int FROM showing_seats ss WHERE ss.showing_id = ${showings.id} AND ss.status = 'booked')`,
      capacity: sql<number>`(SELECT count(*)::int FROM showing_seats ss WHERE ss.showing_id = ${showings.id})`,
    })
    .from(showings)
    .innerJoin(films, eq(films.id, showings.filmId))
    .where(
      and(
        eq(showings.screenId, screenId),
        sql`(${showings.startsAt} AT TIME ZONE ${CINEMA_TIME_ZONE})::date = ${date}::date`,
      ),
    )
    .orderBy(asc(showings.startsAt));
}

/** Every seat in a showing with its state and, when sold, the booking it belongs to. */
export async function getShowingSeatsWithBookings(showingId: string) {
  return db.execute<{
    seat_id: string;
    row_label: string;
    number: number;
    type: "standard" | "wheelchair" | "companion";
    x: number;
    y: number;
    status: "available" | "held" | "booked";
    hold_active: boolean;
    booking_id: string | null;
  }>(sql`
    SELECT se.id AS seat_id, se.row_label, se.number, se.type, se.x, se.y,
           ss.status, (ss.status = 'held' AND ss.hold_expires_at > now()) AS hold_active,
           ss.booking_id
      FROM showing_seats ss
      JOIN seats se ON se.id = ss.seat_id
     WHERE ss.showing_id = ${showingId}::uuid
     ORDER BY se.y, se.x
  `);
}

/** Bookings for a showing with booker details and their tickets, newest first. */
export async function listShowingBookings(showingId: string) {
  const rows = await db
    .select({
      bookingId: bookings.id,
      confirmationCode: bookings.confirmationCode,
      customerName: bookings.customerName,
      email: bookings.email,
      totalCents: bookings.totalCents,
      createdAt: bookings.createdAt,
      seatId: bookingSeats.seatId,
      rowLabel: seats.rowLabel,
      number: seats.number,
      ticketType: bookingSeats.ticketType,
    })
    .from(bookings)
    .innerJoin(bookingSeats, eq(bookingSeats.bookingId, bookings.id))
    .innerJoin(seats, eq(seats.id, bookingSeats.seatId))
    .where(and(eq(bookings.showingId, showingId), eq(bookings.status, "active"), isNull(bookingSeats.releasedAt)))
    .orderBy(desc(bookings.createdAt), asc(seats.y), asc(seats.number));
  return rows;
}

/**
 * Find bookings across every showing by confirmation number (full or first 4+
 * characters), booker name, or (only when `includeEmail`) email. Newest showings last.
 */
export async function searchBookings(term: string, options: { includeEmail: boolean; limit?: number }) {
  const text = term.trim();
  const code = text.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const clauses: SQL[] = [ilike(bookings.customerName, `%${escapeLike(text)}%`)];
  if (code.length >= 4) {
    const withPrefix = code.startsWith("MQ") ? code : `MQ${code}`;
    clauses.push(ilike(bookings.confirmationCode, `${escapeLike(withPrefix)}%`));
  }
  if (options.includeEmail) clauses.push(ilike(bookings.email, `%${escapeLike(text)}%`));

  return db
    .select({
      id: bookings.id,
      confirmationCode: bookings.confirmationCode,
      customerName: bookings.customerName,
      email: bookings.email,
      status: bookings.status,
      createdAt: bookings.createdAt,
      showingId: showings.id,
      startsAt: showings.startsAt,
      filmTitle: films.title,
      where: sql<string>`${locations.name} || ' · ' || ${screens.name}`,
      seats: sql<number>`(SELECT count(*)::int FROM booking_seats bs WHERE bs.booking_id = ${bookings.id} AND bs.released_at IS NULL)`,
    })
    .from(bookings)
    .innerJoin(showings, eq(showings.id, bookings.showingId))
    .innerJoin(films, eq(films.id, showings.filmId))
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .innerJoin(locations, eq(locations.id, screens.locationId))
    .where(or(...clauses))
    .orderBy(desc(bookings.createdAt))
    .limit(options.limit ?? 25);
}

/** Treat the user's text literally inside a LIKE pattern. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Where a showing is (theater, screen, cinema-local date), to open the dashboard on it. */
export async function locateShowing(showingId: string) {
  const [row] = await db
    .select({
      screenId: showings.screenId,
      locationId: screens.locationId,
      date: sql<string>`to_char(${showings.startsAt} AT TIME ZONE ${CINEMA_TIME_ZONE}, 'YYYY-MM-DD')`,
    })
    .from(showings)
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .where(eq(showings.id, showingId));
  return row ?? null;
}

/** An active booking being modified: who, how many seats, and where it is now. */
export async function getBookingForModify(bookingId: string) {
  const [booking] = await db
    .select({
      id: bookings.id,
      customerName: bookings.customerName,
      email: bookings.email,
      showingId: bookings.showingId,
      status: bookings.status,
      where: sql<string>`${films.title} || ', ' || to_char(${showings.startsAt} AT TIME ZONE ${CINEMA_TIME_ZONE}, 'Dy Mon FMDD FMHH12:MI AM') || ', ' || ${screens.name}`,
    })
    .from(bookings)
    .innerJoin(showings, eq(showings.id, bookings.showingId))
    .innerJoin(films, eq(films.id, showings.filmId))
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .where(eq(bookings.id, bookingId));
  if (!booking || booking.status !== "active") return null;
  const tickets = await db
    .select({ seatId: bookingSeats.seatId, label: sql<string>`${seats.rowLabel} || ${seats.number}` })
    .from(bookingSeats)
    .innerJoin(seats, eq(seats.id, bookingSeats.seatId))
    .where(and(eq(bookingSeats.bookingId, bookingId), isNull(bookingSeats.releasedAt)))
    .orderBy(asc(seats.y), asc(seats.x));
  return { ...booking, seatIds: tickets.map((t) => t.seatId), seatLabels: tickets.map((t) => t.label) };
}

/** A showing's title, time and place for the staff seat picker. */
export async function getShowingHeading(showingId: string) {
  const [row] = await db
    .select({
      title: films.title,
      startsAt: showings.startsAt,
      locationId: screens.locationId,
      where: sql<string>`${locations.name} || ' · ' || ${screens.name}`,
    })
    .from(showings)
    .innerJoin(films, eq(films.id, showings.filmId))
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .innerJoin(locations, eq(locations.id, screens.locationId))
    .where(eq(showings.id, showingId));
  return row ?? null;
}
