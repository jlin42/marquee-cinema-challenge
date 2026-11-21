/**
 * Staff write actions on bookings: cancel, and move to other seats or another showing.
 *
 * Same guarantees as customer booking (see booking.ts):
 *  - Every change runs in one transaction that locks the booking row, then all affected
 *    showing_seats rows in (showing_id, seat_id) order, so it can't race a customer.
 *  - Target seats must be free (or already this booking's); the claim is checked by row count.
 *  - booking_seats keeps released rows as history; the partial unique index still allows
 *    at most one *active* sale per seat.
 *  - Each action writes an audit entry in the same transaction: no change without a record.
 *
 * No framework imports, so scripts (the seed) can use it too.
 */
import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingSeats, bookings, films, locations, screens, seats, showings, staffActions } from "@/db/schema";
import { CINEMA_TIME_ZONE } from "@/lib/time";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ActionResult =
  | { ok: true; summary: string; showingId: string }
  | { ok: false; code: "NOT_FOUND" | "NOT_ACTIVE" | "SEAT_COUNT" | "SEATS_TAKEN" | "SHOWING_UNAVAILABLE"; message: string; seatIds?: string[] };

class ActionFailed extends Error {
  constructor(readonly result: Extract<ActionResult, { ok: false }>) {
    super(result.message);
  }
}
const fail = (code: Extract<ActionResult, { ok: false }>["code"], message: string, seatIds?: string[]): never => {
  throw new ActionFailed({ ok: false, code, message, seatIds });
};

const uuidList = (ids: string[]): SQL => sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
const ref = (bookingId: string) => bookingId.slice(0, 8).toUpperCase();

/** Lock a booking and load what the audit summary needs. */
async function lockBooking(tx: Tx, bookingId: string) {
  const [booking] = await tx
    .select({
      id: bookings.id,
      showingId: bookings.showingId,
      holdId: bookings.holdId,
      status: bookings.status,
      customerName: bookings.customerName,
      email: bookings.email,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .for("update");
  if (!booking) fail("NOT_FOUND", "That booking doesn't exist.");
  if (booking!.status !== "active") fail("NOT_ACTIVE", "That booking has already been cancelled.");
  const tickets = await tx
    .select({
      seatId: bookingSeats.seatId,
      label: sql<string>`${seats.rowLabel} || ${seats.number}`,
      ticketType: bookingSeats.ticketType,
      priceCents: bookingSeats.priceCents,
      feeCents: bookingSeats.feeCents,
    })
    .from(bookingSeats)
    .innerJoin(seats, eq(seats.id, bookingSeats.seatId))
    .where(and(eq(bookingSeats.bookingId, bookingId), isNull(bookingSeats.releasedAt)))
    .orderBy(asc(seats.y), asc(seats.x));
  return { ...booking!, tickets };
}

/** "Orbit of Ash, Nov 28 7:45 PM, Harrisonburg Cinema Screen 2" */
async function describeShowing(tx: Tx, showingId: string) {
  const [s] = await tx
    .select({
      startsAt: showings.startsAt,
      text: sql<string>`${films.title} || ', ' || to_char(${showings.startsAt} AT TIME ZONE ${CINEMA_TIME_ZONE}, 'Mon FMDD FMHH12:MI AM')
                         || ', ' || ${locations.name} || ' ' || ${screens.name}`,
      screenId: showings.screenId,
    })
    .from(showings)
    .innerJoin(films, eq(films.id, showings.filmId))
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .innerJoin(locations, eq(locations.id, screens.locationId))
    .where(eq(showings.id, showingId));
  return s ?? null;
}

/** Release a booking's active seats back to sale (inventory + history rows). */
async function releaseSeats(tx: Tx, bookingId: string, at: Date) {
  await tx.execute(sql`
    UPDATE showing_seats
       SET status = 'available', booking_id = NULL, hold_id = NULL, hold_expires_at = NULL
     WHERE booking_id = ${bookingId}::uuid
  `);
  await tx
    .update(bookingSeats)
    .set({ releasedAt: at })
    .where(and(eq(bookingSeats.bookingId, bookingId), isNull(bookingSeats.releasedAt)));
}

async function run(work: (tx: Tx) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await db.transaction(work);
  } catch (err) {
    if (err instanceof ActionFailed) return err.result;
    throw err;
  }
}

// ---------------------------------------------------------------------------

/** Cancel a booking: its seats go back on sale; the booking is kept as cancelled. */
export async function cancelBooking(input: { actorId: string; bookingId: string; at?: Date }): Promise<ActionResult> {
  const at = input.at ?? new Date();
  return run(async (tx) => {
    const booking = await lockBooking(tx, input.bookingId);
    const seatIds = booking.tickets.map((t) => t.seatId);
    // Lock the seat rows in the standard order before changing them.
    if (seatIds.length > 0) {
      await tx.execute(sql`
        SELECT 1 FROM showing_seats
         WHERE showing_id = ${booking.showingId}::uuid AND seat_id IN (${uuidList(seatIds)})
         ORDER BY seat_id FOR UPDATE
      `);
    }
    await releaseSeats(tx, booking.id, at);
    await tx.update(bookings).set({ status: "cancelled", cancelledAt: at }).where(eq(bookings.id, booking.id));

    const showing = await describeShowing(tx, booking.showingId);
    const labels = booking.tickets.map((t) => t.label).join(", ");
    const summary = `Cancelled booking ${ref(booking.id)} for ${booking.customerName ?? booking.email} (${labels}) · ${showing?.text ?? ""}`;
    await tx.insert(staffActions).values({
      staffUserId: input.actorId,
      action: "booking.cancel",
      bookingId: booking.id,
      summary,
      details: { seats: booking.tickets.map((t) => t.label), showingId: booking.showingId, customer: booking.customerName },
      createdAt: at,
    });
    return { ok: true, summary, showingId: booking.showingId };
  });
}

/**
 * Move a booking to other seats, in the same showing or another one. Keeps each
 * ticket's type and price (in seat order). `seatIds` must match the booking's seat count.
 */
export async function moveBooking(input: {
  actorId: string;
  bookingId: string;
  toShowingId: string;
  seatIds: string[];
  at?: Date;
}): Promise<ActionResult> {
  const at = input.at ?? new Date();
  const newSeatIds = [...new Set(input.seatIds)];
  return run(async (tx) => {
    const booking = await lockBooking(tx, input.bookingId);
    if (newSeatIds.length !== booking.tickets.length) {
      fail("SEAT_COUNT", `Choose exactly ${booking.tickets.length} seat${booking.tickets.length === 1 ? "" : "s"}.`);
    }

    const target = await describeShowing(tx, input.toShowingId);
    if (!target || target.startsAt.getTime() <= Date.now()) {
      fail("SHOWING_UNAVAILABLE", "That showing doesn't exist or has already started.");
    }

    // Lock old and new seat rows together, in (showing, seat) order.
    const oldSeatIds = booking.tickets.map((t) => t.seatId);
    const locked = await tx.execute<{ showing_id: string; seat_id: string; free: boolean; ours: boolean }>(sql`
      SELECT showing_id, seat_id,
             (status = 'available' OR (status = 'held' AND hold_expires_at <= now())) AS free,
             (booking_id = ${booking.id}::uuid) AS ours
        FROM showing_seats
       WHERE (showing_id = ${input.toShowingId}::uuid AND seat_id IN (${uuidList(newSeatIds)}))
          OR (showing_id = ${booking.showingId}::uuid AND seat_id IN (${uuidList(oldSeatIds)}))
       ORDER BY showing_id, seat_id
         FOR UPDATE
    `);
    const targetRows = locked.rows.filter((r) => r.showing_id === input.toShowingId && newSeatIds.includes(r.seat_id));
    const unavailable = newSeatIds.filter((id) => {
      const row = targetRows.find((r) => r.seat_id === id);
      return !row || !(row.free || row.ours);
    });
    if (unavailable.length > 0) fail("SEATS_TAKEN", "Some of those seats are no longer available.", unavailable);

    const before = await describeShowing(tx, booking.showingId);
    await releaseSeats(tx, booking.id, at);

    const claimed = await tx.execute(sql`
      UPDATE showing_seats
         SET status = 'booked', booking_id = ${booking.id}::uuid, hold_id = ${booking.holdId}::uuid, hold_expires_at = NULL
       WHERE showing_id = ${input.toShowingId}::uuid
         AND seat_id IN (${uuidList(newSeatIds)})
         AND (status = 'available' OR (status = 'held' AND hold_expires_at <= now()))
    `);
    if (claimed.rowCount !== newSeatIds.length) fail("SEATS_TAKEN", "Some of those seats are no longer available.");

    // New ticket rows, carrying each ticket's type and price over in seat order.
    const newSeats = await tx
      .select({ id: seats.id, label: sql<string>`${seats.rowLabel} || ${seats.number}` })
      .from(seats)
      .where(sql`${seats.id} IN (${uuidList(newSeatIds)})`)
      .orderBy(asc(seats.y), asc(seats.x));
    await tx.insert(bookingSeats).values(
      newSeats.map((seat, i) => {
        const t = booking.tickets[i]!;
        return {
          bookingId: booking.id,
          showingId: input.toShowingId,
          seatId: seat.id,
          ticketType: t.ticketType,
          priceCents: t.priceCents,
          feeCents: t.feeCents,
        };
      }),
    );
    await tx.update(bookings).set({ showingId: input.toShowingId }).where(eq(bookings.id, booking.id));

    const fromLabels = booking.tickets.map((t) => t.label).join(", ");
    const toLabels = newSeats.map((s) => s.label).join(", ");
    const sameShowing = booking.showingId === input.toShowingId;
    const summary = sameShowing
      ? `Moved booking ${ref(booking.id)} for ${booking.customerName ?? booking.email} from ${fromLabels} to ${toLabels} · ${target!.text}`
      : `Moved booking ${ref(booking.id)} for ${booking.customerName ?? booking.email} from ${before?.text} (${fromLabels}) to ${target!.text} (${toLabels})`;
    await tx.insert(staffActions).values({
      staffUserId: input.actorId,
      action: "booking.move",
      bookingId: booking.id,
      summary,
      details: {
        from: { showingId: booking.showingId, seats: booking.tickets.map((t) => t.label) },
        to: { showingId: input.toShowingId, seats: newSeats.map((s) => s.label) },
      },
      createdAt: at,
    });
    return { ok: true, summary, showingId: input.toShowingId };
  });
}
