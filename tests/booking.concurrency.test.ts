/**
 * Proves the core guarantee against a real Postgres: a seat can never be sold
 * twice, even when many customers race for it at the same moment.
 *
 * Requires the database to be running and migrated (npm run db:up && npm run db:migrate).
 * Each test builds its own showing, so it doesn't depend on seed data.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db/client";
import {
  bookingSeats,
  bookings,
  films,
  holds,
  locations,
  screens,
  seats,
  showingSeats,
  showings,
} from "@/db/schema";
import { confirmHold, createHold, getSeatMap, releaseHold } from "@/server/booking";
import { HoldExpiredError, HoldNotFoundError, SeatConflictError, isUniqueViolation } from "@/server/errors";

const createdShowings: string[] = [];
const createdScreens: string[] = [];
const createdLocations: string[] = [];
const createdFilms: string[] = [];

/** A fresh showing (starting tomorrow) on its own screen with `seatCount` seats. */
async function makeShowing(seatCount = 8) {
  const [loc] = await db.insert(locations).values({ name: "Test Cinema", city: "Test" }).returning();
  const [screen] = await db.insert(screens).values({ locationId: loc!.id, name: "Test Screen" }).returning();
  const seatRows = await db
    .insert(seats)
    .values(
      Array.from({ length: seatCount }, (_, i) => ({
        screenId: screen!.id,
        rowLabel: "A",
        number: i + 1,
        x: i + 1,
        y: 0,
      })),
    )
    .returning();
  const [film] = await db.insert(films).values({ title: "Test Film", runtimeMinutes: 90 }).returning();
  const [showing] = await db
    .insert(showings)
    .values({ screenId: screen!.id, filmId: film!.id, startsAt: sql`now() + interval '1 day'` })
    .returning();
  await db.insert(showingSeats).values(seatRows.map((s) => ({ showingId: showing!.id, seatId: s.id })));
  createdShowings.push(showing!.id);
  createdScreens.push(screen!.id);
  createdLocations.push(loc!.id);
  createdFilms.push(film!.id);
  return { showingId: showing!.id, seatIds: seatRows.map((s) => s.id).sort() };
}

const session = () => `test-session-${randomUUID()}`;

let fx: Awaited<ReturnType<typeof makeShowing>>;
beforeEach(async () => {
  fx = await makeShowing();
});

afterAll(async () => {
  if (createdShowings.length) {
    await db.delete(bookingSeats).where(inArray(bookingSeats.showingId, createdShowings));
    await db.delete(showingSeats).where(inArray(showingSeats.showingId, createdShowings));
    await db.delete(bookings).where(inArray(bookings.showingId, createdShowings));
    await db.delete(holds).where(inArray(holds.showingId, createdShowings));
    await db.delete(showings).where(inArray(showings.id, createdShowings));
    await db.delete(seats).where(inArray(seats.screenId, createdScreens));
    await db.delete(screens).where(inArray(screens.id, createdScreens));
    await db.delete(locations).where(inArray(locations.id, createdLocations));
    await db.delete(films).where(inArray(films.id, createdFilms));
  }
  await pool.end();
});

describe("holds under contention", () => {
  it("100 customers racing for one seat: exactly one wins", async () => {
    const seat = fx.seatIds[0]!;
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () =>
        createHold({ showingId: fx.showingId, seatIds: [seat], sessionId: session() }),
      ),
    );

    const wins = results.filter((r) => r.status === "fulfilled");
    const losses = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(99);
    for (const l of losses) expect(l.reason).toBeInstanceOf(SeatConflictError);

    const [row] = await db
      .select()
      .from(showingSeats)
      .where(sql`${showingSeats.showingId} = ${fx.showingId} AND ${showingSeats.seatId} = ${seat}`);
    expect(row?.status).toBe("held");
  });

  it("overlapping multi-seat requests: all-or-nothing, no seat held twice, no deadlocks", async () => {
    // 60 requests for random overlapping pairs/triples among 4 seats.
    const pool4 = fx.seatIds.slice(0, 4);
    const requests = Array.from({ length: 60 }, () => {
      const shuffled = [...pool4].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
    });

    const results = await Promise.allSettled(
      requests.map((seatIds) => createHold({ showingId: fx.showingId, seatIds, sessionId: session() })),
    );

    // Every failure is a clean conflict (a deadlock would surface as a Postgres error).
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(SeatConflictError);
    }

    // Each successful hold owns every seat it asked for, and no seat is claimed twice.
    const wins = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    expect(wins.length).toBeGreaterThanOrEqual(1);
    const claimed = wins.flatMap((h) => h.seatIds);
    expect(new Set(claimed).size).toBe(claimed.length);

    const rows = await db.select().from(showingSeats).where(eq(showingSeats.showingId, fx.showingId));
    for (const h of wins) {
      for (const seatId of h.seatIds) {
        expect(rows.find((r) => r.seatId === seatId)?.holdId).toBe(h.id);
      }
    }
  });
});

describe("confirm", () => {
  it("is idempotent: 20 parallel confirms of one hold produce one booking", async () => {
    const sid = session();
    const hold = await createHold({ showingId: fx.showingId, seatIds: fx.seatIds.slice(0, 2), sessionId: sid });

    const results = await Promise.all(
      Array.from({ length: 20 }, () => confirmHold({ holdId: hold.id, sessionId: sid, email: "a@example.com" })),
    );

    expect(new Set(results.map((b) => b.id)).size).toBe(1);
    const rows = await db.select().from(bookings).where(eq(bookings.holdId, hold.id));
    expect(rows).toHaveLength(1);
    expect(results[0]!.seatIds).toEqual(hold.seatIds);

    const map = await getSeatMap(fx.showingId);
    expect(map.filter((s) => s.status === "booked").map((s) => s.id).sort()).toEqual(hold.seatIds);
  });

  it("rejects a hold owned by another session", async () => {
    const hold = await createHold({ showingId: fx.showingId, seatIds: [fx.seatIds[0]!], sessionId: session() });
    await expect(
      confirmHold({ holdId: hold.id, sessionId: session(), email: "x@example.com" }),
    ).rejects.toBeInstanceOf(HoldNotFoundError);
  });

  it("an expired hold frees its seats, and can no longer be confirmed", async () => {
    const first = session();
    const hold = await createHold({
      showingId: fx.showingId,
      seatIds: [fx.seatIds[0]!],
      sessionId: first,
      ttlSeconds: 1,
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Someone else can now take the seat…
    const second = await createHold({ showingId: fx.showingId, seatIds: [fx.seatIds[0]!], sessionId: session() });
    expect(second.seatIds).toEqual([fx.seatIds[0]]);

    // …and the original customer's late confirm fails cleanly.
    await expect(
      confirmHold({ holdId: hold.id, sessionId: first, email: "late@example.com" }),
    ).rejects.toBeInstanceOf(HoldExpiredError);
  });

  it("released seats become available immediately", async () => {
    const sid = session();
    const hold = await createHold({ showingId: fx.showingId, seatIds: [fx.seatIds[0]!], sessionId: sid });
    await releaseHold({ holdId: hold.id, sessionId: sid });
    const again = await createHold({ showingId: fx.showingId, seatIds: [fx.seatIds[0]!], sessionId: session() });
    expect(again.seatIds).toEqual([fx.seatIds[0]]);
  });
});

describe("database backstop", () => {
  it("UNIQUE (showing_id, seat_id) rejects a second sale even if app logic were bypassed", async () => {
    const sid = session();
    const hold = await createHold({ showingId: fx.showingId, seatIds: [fx.seatIds[0]!], sessionId: sid });
    const booking = await confirmHold({ holdId: hold.id, sessionId: sid, email: "a@example.com" });

    const err = await db
      .insert(bookingSeats)
      .values({ bookingId: booking.id, showingId: fx.showingId, seatId: fx.seatIds[0]! })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(isUniqueViolation(err)).toBe(true);
  });
});
