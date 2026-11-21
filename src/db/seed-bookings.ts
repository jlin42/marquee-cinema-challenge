/**
 * Demo bookings for the seed: fills showings with realistic groups of seats.
 * Every booked seat goes through the same records a real booking creates
 * (hold → booking → booking_seats → showing_seats), so all constraints apply.
 *
 * Deterministic: a fixed random seed gives the same data on every run.
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { bookings, bookingSeats, holds, type ticketTypes } from "./schema";

export type SeedSeat = { id: string; rowLabel: string; number: number; x: number; type: "standard" | "wheelchair" | "companion" };
export type SeedShowing = { id: string; screenId: string; startsAt: Date };

/** Mulberry32: tiny seeded PRNG, so demo data is reproducible. */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
  };
}
export type Random = ReturnType<typeof createRandom>;

// Party sizes: mostly couples, then singles, small groups and families.
const PARTY_SIZES = [1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 4, 5, 6] as const;
const WHEELCHAIR_BOOK_CHANCE = 0.15;

/**
 * Choose which seats are booked for one showing, as groups sitting together.
 * `occupancy` is 0–1; 1 books every seat (sold out).
 */
export function chooseBookedGroups(seats: SeedSeat[], occupancy: number, random: Random): string[][] {
  if (occupancy >= 1) return groupWholeRows(seats);

  // Runs of side-by-side seats (consecutive x in the same row); aisles break runs.
  const runs = toRuns(seats.filter((s) => s.type !== "wheelchair"));
  const taken = new Set<string>();
  const groups: string[][] = [];
  const target = Math.round(seats.length * occupancy);

  let misses = 0;
  while (taken.size < target && misses < 200) {
    const run = random.pick(runs);
    const size = Math.min(random.pick(PARTY_SIZES), target - taken.size);
    const start = random.int(0, Math.max(0, run.length - size));
    const group = run.slice(start, start + size);
    if (group.length === size && group.every((s) => !taken.has(s.id))) {
      group.forEach((s) => taken.add(s.id));
      groups.push(group.map((s) => s.id));
      misses = 0;
    } else {
      misses++;
    }
  }
  // Top up with single seats if the room got fragmented.
  for (const s of seats) {
    if (taken.size >= target) break;
    if (!taken.has(s.id) && s.type !== "wheelchair") {
      taken.add(s.id);
      groups.push([s.id]);
    }
  }
  // Occasionally a wheelchair space (with its companion seat, if free) is booked.
  for (const w of seats.filter((s) => s.type === "wheelchair")) {
    if (!random.chance(WHEELCHAIR_BOOK_CHANCE)) continue;
    const companion = seats.find((s) => s.type === "companion" && s.rowLabel === w.rowLabel && Math.abs(s.x - w.x) === 1);
    const group = [w, ...(companion && !taken.has(companion.id) ? [companion] : [])];
    group.forEach((s) => taken.add(s.id));
    groups.push(group.map((s) => s.id));
  }
  return groups;
}

function toRuns(seats: SeedSeat[]): SeedSeat[][] {
  const sorted = [...seats].sort((a, b) => a.rowLabel.localeCompare(b.rowLabel) || a.x - b.x);
  const runs: SeedSeat[][] = [];
  for (const seat of sorted) {
    const run = runs.at(-1);
    const prev = run?.at(-1);
    if (run && prev && prev.rowLabel === seat.rowLabel && seat.x === prev.x + 1) run.push(seat);
    else runs.push([seat]);
  }
  return runs;
}

/** Sold out: book everything, in groups of up to 4 along each run. */
function groupWholeRows(seats: SeedSeat[]): string[][] {
  return toRuns(seats).flatMap((run) => {
    const groups: string[][] = [];
    for (let i = 0; i < run.length; i += 4) groups.push(run.slice(i, i + 4).map((s) => s.id));
    return groups;
  });
}

const BATCH = 1000;
const HOLD_SECONDS = 8 * 60;

/** Write the chosen groups as holds, bookings, booking_seats, and booked inventory. */
// Ticket mix for demo bookings: mostly General, some Child and Senior.
const TICKET_MIX = ["general", "general", "general", "general", "general", "general", "general", "child", "child", "senior"] as const;

export async function insertBookings(
  db: Db,
  plan: { showing: SeedShowing; groups: string[][] }[],
  random: Random,
  priceList: (typeof ticketTypes.$inferSelect)[],
): Promise<number> {
  const prices = new Map(priceList.map((t) => [t.code, t]));
  const holdRows: (typeof holds.$inferInsert)[] = [];
  const bookingRows: (typeof bookings.$inferInsert)[] = [];
  const seatRows: (typeof bookingSeats.$inferInsert & { holdId: string })[] = [];
  let guest = 0;

  for (const { showing, groups } of plan) {
    for (const seatIds of groups) {
      const holdId = randomUUID();
      const bookingId = randomUUID();
      // Booked some time in the 10 days before the showing (and not in the future).
      const createdAt = new Date(
        Math.min(Date.now(), showing.startsAt.getTime()) - random.int(10, 60 * 24 * 10) * 60_000,
      );
      holdRows.push({
        id: holdId,
        showingId: showing.id,
        sessionId: "seed",
        seatIds,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + HOLD_SECONDS * 1000),
      });
      let totalCents = 0;
      for (const seatId of seatIds) {
        const type = prices.get(random.pick(TICKET_MIX))!;
        totalCents += type.priceCents + type.feeCents;
        seatRows.push({
          bookingId,
          holdId,
          showingId: showing.id,
          seatId,
          ticketType: type.code,
          priceCents: type.priceCents,
          feeCents: type.feeCents,
        });
      }
      bookingRows.push({ id: bookingId, showingId: showing.id, holdId, email: `guest${++guest}@example.com`, totalCents, createdAt });
    }
  }

  for (let i = 0; i < holdRows.length; i += BATCH) await db.insert(holds).values(holdRows.slice(i, i + BATCH));
  for (let i = 0; i < bookingRows.length; i += BATCH) await db.insert(bookings).values(bookingRows.slice(i, i + BATCH));
  for (let i = 0; i < seatRows.length; i += BATCH) {
    const chunk = seatRows.slice(i, i + BATCH);
    await db.insert(bookingSeats).values(chunk.map(({ holdId: _holdId, ...row }) => row));
    await db.execute(sql`
      UPDATE showing_seats AS ss
         SET status = 'booked', hold_id = v.hold_id, booking_id = v.booking_id, hold_expires_at = NULL
        FROM (VALUES ${sql.join(
          chunk.map((r) => sql`(${r.showingId}::uuid, ${r.seatId}::uuid, ${r.holdId}::uuid, ${r.bookingId}::uuid)`),
          sql`, `,
        )}) AS v(showing_id, seat_id, hold_id, booking_id)
       WHERE ss.showing_id = v.showing_id AND ss.seat_id = v.seat_id
    `);
  }
  return seatRows.length;
}
