/**
 * Booking service: the only code that changes seat state.
 *
 * How a seat is guaranteed never to be sold twice:
 *  1. Every state change runs in a transaction that first locks the affected
 *     rows with SELECT ... FOR UPDATE, always in seat_id order. Concurrent
 *     requests for the same seat queue up behind each other instead of racing,
 *     and the consistent lock order prevents deadlocks between overlapping
 *     multi-seat requests.
 *  2. The UPDATE that changes seat state repeats its preconditions in the
 *     WHERE clause and we check the affected row count, so a stale read can't
 *     slip through. Multi-seat requests are all-or-nothing.
 *  3. Backstop: booking_seats has UNIQUE (showing_id, seat_id). Even if the
 *     logic above had a bug, Postgres would reject a second sale of a seat.
 *
 * Holds expire lazily: an expired hold is treated as available inside the
 * queries themselves, so correctness never depends on a cleanup job.
 */
import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, bookingSeats, holds, seats, showings, showingSeats } from "@/db/schema";
import { env } from "@/env";
import {
  HoldExpiredError,
  HoldNotFoundError,
  InvalidTicketsError,
  SeatConflictError,
  ShowingUnavailableError,
  isUniqueViolation,
} from "./errors";
import { listTicketTypes, priceTickets, type TicketTypeCode } from "./pricing";

export const MAX_SEATS_PER_HOLD = 10;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const uuidList = (ids: string[]): SQL =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

// ---------------------------------------------------------------------------
// Holds
// ---------------------------------------------------------------------------

export type Hold = { id: string; showingId: string; seatIds: string[]; expiresAt: Date };

export async function createHold(input: {
  showingId: string;
  seatIds: string[];
  sessionId: string;
  /** Override for tests; defaults to HOLD_TTL_SECONDS. */
  ttlSeconds?: number;
}): Promise<Hold> {
  const seatIds = [...new Set(input.seatIds)].sort();
  if (seatIds.length === 0 || seatIds.length > MAX_SEATS_PER_HOLD) {
    throw new RangeError(`Select between 1 and ${MAX_SEATS_PER_HOLD} seats.`);
  }
  const ttl = input.ttlSeconds ?? env.HOLD_TTL_SECONDS;

  return db.transaction(async (tx) => {
    await assertShowingOpen(tx, input.showingId);

    // 1. Lock the requested seat rows in a fixed order.
    const locked = await tx.execute<{ seat_id: string; free: boolean }>(sql`
      SELECT seat_id,
             (status = 'available' OR (status = 'held' AND hold_expires_at <= now())) AS free
        FROM showing_seats
       WHERE showing_id = ${input.showingId}::uuid
         AND seat_id IN (${uuidList(seatIds)})
       ORDER BY seat_id
         FOR UPDATE
    `);

    const freeIds = new Set(locked.rows.filter((r) => r.free).map((r) => r.seat_id));
    const conflicts = seatIds.filter((id) => !freeIds.has(id));
    if (conflicts.length > 0) throw new SeatConflictError(conflicts);

    // 2. Create the hold; expiry is computed by the database clock.
    const [hold] = await tx
      .insert(holds)
      .values({
        showingId: input.showingId,
        sessionId: input.sessionId,
        seatIds,
        expiresAt: sql`now() + make_interval(secs => ${ttl})`,
      })
      .returning();
    if (!hold) throw new Error("Failed to create hold");

    // 3. Claim the seats, repeating the precondition (belt and braces).
    const claimed = await tx.execute(sql`
      UPDATE showing_seats
         SET status = 'held',
             hold_id = ${hold.id}::uuid,
             hold_expires_at = (SELECT expires_at FROM holds WHERE id = ${hold.id}::uuid)
       WHERE showing_id = ${input.showingId}::uuid
         AND seat_id IN (${uuidList(seatIds)})
         AND (status = 'available' OR (status = 'held' AND hold_expires_at <= now()))
    `);
    if (claimed.rowCount !== seatIds.length) throw new SeatConflictError(seatIds);

    return { id: hold.id, showingId: hold.showingId, seatIds, expiresAt: hold.expiresAt };
  });
}

/** Release a hold early (customer deselects or abandons checkout). Idempotent. */
export async function releaseHold(input: { holdId: string; sessionId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const hold = await lockOwnedHold(tx, input.holdId, input.sessionId);
    await tx.execute(sql`
      UPDATE showing_seats
         SET status = 'available', hold_id = NULL, hold_expires_at = NULL
       WHERE hold_id = ${hold.id}::uuid AND status = 'held'
    `);
    await tx.update(holds).set({ expiresAt: sql`now()` }).where(eq(holds.id, hold.id));
  });
}

// ---------------------------------------------------------------------------
// Confirm (hold -> booking)
// ---------------------------------------------------------------------------

export type BookedTicket = { seatId: string; ticketType: TicketTypeCode; priceCents: number; feeCents: number };

export type Booking = {
  id: string;
  showingId: string;
  email: string;
  seatIds: string[];
  tickets: BookedTicket[];
  totalCents: number;
  createdAt: Date;
};

/**
 * Turn a hold into a booking. `tickets` maps seat id → ticket type (missing = General).
 * Prices always come from the server's price list, never from the client.
 */
export async function confirmHold(input: {
  holdId: string;
  sessionId: string;
  email: string;
  /** Main ticket booker's name. */
  customerName?: string;
  tickets?: Partial<Record<string, TicketTypeCode>>;
}): Promise<Booking> {
  try {
    return await db.transaction(async (tx) => {
      // Locking the hold row serializes concurrent confirms of the same hold.
      const hold = await lockOwnedHold(tx, input.holdId, input.sessionId);

      // Idempotent: a retried confirm returns the booking that already exists.
      const existing = await findBookingByHold(tx, hold.id);
      if (existing) return existing;

      // Price the tickets from the server's price list.
      const priced = priceTickets(hold.seatIds, input.tickets ?? {}, await listTicketTypes(tx));
      if (!priced) throw new InvalidTicketsError();

      // Payment for priced.totalCents would be authorized here (mocked in this demo).

      // Seats must still be held by this hold and unexpired. All or nothing.
      const booked = await tx.execute(sql`
        UPDATE showing_seats
           SET status = 'booked', hold_expires_at = NULL
         WHERE hold_id = ${hold.id}::uuid
           AND status = 'held'
           AND hold_expires_at > now()
      `);
      if (booked.rowCount !== hold.seatIds.length) throw new HoldExpiredError();

      const [booking] = await tx
        .insert(bookings)
        .values({
          showingId: hold.showingId,
          holdId: hold.id,
          email: input.email,
          customerName: input.customerName ?? null,
          totalCents: priced.totalCents,
        })
        .returning();
      if (!booking) throw new Error("Failed to create booking");

      // Backstop: UNIQUE (showing_id, seat_id) rejects any double sale.
      await tx.insert(bookingSeats).values(
        priced.lines.map((line) => ({ bookingId: booking.id, showingId: hold.showingId, ...line })),
      );
      await tx
        .update(showingSeats)
        .set({ bookingId: booking.id })
        .where(and(eq(showingSeats.holdId, hold.id), eq(showingSeats.status, "booked")));

      return { ...booking, seatIds: hold.seatIds, tickets: priced.lines };
    });
  } catch (err) {
    // A concurrent confirm of the same hold won the race: return its booking.
    if (isUniqueViolation(err)) {
      const existing = await db.transaction((tx) => findBookingByHold(tx, input.holdId));
      if (existing) return existing;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type SeatView = {
  id: string;
  row: string;
  number: number;
  type: "standard" | "wheelchair" | "companion";
  x: number;
  y: number;
  status: "available" | "held" | "booked";
  /** True when the seat is held by the caller's own hold. */
  mine: boolean;
};

/** Seat map for a showing, with expired holds reported as available. */
export async function getSeatMap(showingId: string, sessionId?: string): Promise<SeatView[]> {
  const rows = await db
    .select({
      id: seats.id,
      row: seats.rowLabel,
      number: seats.number,
      type: seats.type,
      x: seats.x,
      y: seats.y,
      status: sql<SeatView["status"]>`CASE
          WHEN ${showingSeats.status} = 'held' AND ${showingSeats.holdExpiresAt} <= now() THEN 'available'
          ELSE ${showingSeats.status}::text END`,
      mine: sessionId
        ? sql<boolean>`COALESCE(${holds.sessionId} = ${sessionId}
            AND ${showingSeats.status} = 'held' AND ${showingSeats.holdExpiresAt} > now(), false)`
        : sql<boolean>`false`,
    })
    .from(showingSeats)
    .innerJoin(seats, eq(seats.id, showingSeats.seatId))
    .leftJoin(holds, eq(holds.id, showingSeats.holdId))
    .where(eq(showingSeats.showingId, showingId))
    .orderBy(asc(seats.y), asc(seats.x));
  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertShowingOpen(tx: Tx, showingId: string) {
  const [showing] = await tx
    .select({ started: sql<boolean>`${showings.startsAt} <= now()` })
    .from(showings)
    .where(eq(showings.id, showingId));
  if (!showing) throw new ShowingUnavailableError("not_found");
  if (showing.started) throw new ShowingUnavailableError("started");
}

async function lockOwnedHold(tx: Tx, holdId: string, sessionId: string) {
  const [hold] = await tx
    .select()
    .from(holds)
    .where(and(eq(holds.id, holdId), eq(holds.sessionId, sessionId)))
    .for("update");
  // Same error whether missing or owned by someone else: don't leak hold ids.
  if (!hold) throw new HoldNotFoundError();
  return hold;
}

async function findBookingByHold(conn: Tx, holdId: string): Promise<Booking | null> {
  const [booking] = await conn.select().from(bookings).where(eq(bookings.holdId, holdId));
  if (!booking) return null;
  const tickets = await conn
    .select({
      seatId: bookingSeats.seatId,
      ticketType: bookingSeats.ticketType,
      priceCents: bookingSeats.priceCents,
      feeCents: bookingSeats.feeCents,
    })
    .from(bookingSeats)
    .where(and(eq(bookingSeats.bookingId, booking.id), isNull(bookingSeats.releasedAt)))
    .orderBy(asc(bookingSeats.seatId));
  return { ...booking, seatIds: tickets.map((t) => t.seatId), tickets };
}
