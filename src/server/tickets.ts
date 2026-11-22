/**
 * The customer's ticket (confirmation page). Only the browser session that booked it
 * can open it: the booking's hold must belong to the caller's session cookie.
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingSeats, bookings, films, holds, locations, screens, seats, showings, ticketTypes } from "@/db/schema";

export type Ticket = {
  id: string;
  confirmationCode: string;
  status: "active" | "cancelled";
  customerName: string | null;
  email: string;
  totalCents: number;
  discountCode: string | null;
  discountCents: number;
  film: { title: string; rating: string | null; runtimeMinutes: number; backdropUrl: string | null };
  startsAt: Date;
  theater: { name: string; address: string | null };
  screenName: string;
  seats: { label: string; type: "standard" | "wheelchair" | "companion"; ticket: string; priceCents: number; feeCents: number }[];
};

export async function getTicket(bookingId: string, sessionId: string | undefined): Promise<Ticket | null> {
  if (!sessionId) return null;
  const [row] = await db
    .select({
      id: bookings.id,
      confirmationCode: bookings.confirmationCode,
      status: bookings.status,
      customerName: bookings.customerName,
      email: bookings.email,
      totalCents: bookings.totalCents,
      discountCode: bookings.discountCode,
      discountCents: bookings.discountCents,
      startsAt: showings.startsAt,
      film: { title: films.title, rating: films.rating, runtimeMinutes: films.runtimeMinutes, backdropUrl: films.backdropUrl },
      theater: { name: locations.name, address: locations.address },
      screenName: screens.name,
    })
    .from(bookings)
    .innerJoin(holds, eq(holds.id, bookings.holdId))
    .innerJoin(showings, eq(showings.id, bookings.showingId))
    .innerJoin(films, eq(films.id, showings.filmId))
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .innerJoin(locations, eq(locations.id, screens.locationId))
    .where(and(eq(bookings.id, bookingId), eq(holds.sessionId, sessionId)));
  if (!row) return null;

  const seatRows = await db
    .select({
      row: seats.rowLabel,
      number: seats.number,
      type: seats.type,
      ticket: ticketTypes.label,
      priceCents: bookingSeats.priceCents,
      feeCents: bookingSeats.feeCents,
    })
    .from(bookingSeats)
    .innerJoin(seats, eq(seats.id, bookingSeats.seatId))
    .innerJoin(ticketTypes, eq(ticketTypes.code, bookingSeats.ticketType))
    .where(and(eq(bookingSeats.bookingId, row.id), isNull(bookingSeats.releasedAt)))
    .orderBy(asc(seats.rowLabel), asc(seats.number));

  return {
    ...row,
    seats: seatRows.map(({ row: r, number, ...rest }) => ({ label: `${r}${number}`, ...rest })),
  };
}
