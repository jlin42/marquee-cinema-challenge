/**
 * Demo bookings and demo staff: shared by the seed script and the admin-only "Load demo
 * data" action, so both fill an existing database without deleting anything.
 * No framework imports.
 */
import { sql } from "drizzle-orm";
import { db, type DbOrTx } from "./client";
import { seats, ticketTypes } from "./schema";
import { CINEMA_TIME_ZONE, cinemaDate } from "../lib/time";
import { seedBookingHistory, seedStaff } from "./seed-staff";
import { chooseBookedGroups, createRandom, insertBookings, type SeedSeat, type SeedShowing } from "./seed-bookings";

// Demo week (the presentation): extra showtimes of the blockbuster, and busy, partly sold-out houses.
export const BUSY_START = "2026-11-25";
export const BUSY_END = "2026-12-01";
export const EXTRA_SHOWTIMES = [
  { screen: 2, time: "09:30" }, // early show in the small room (ends before its 12:15 show)
  { screen: 1, time: "23:30" }, // late show in the standard room (after its 8:30 show)
];
export const EXTRA_TIMES = EXTRA_SHOWTIMES.map((e) => e.time);
export const BUSY_OCCUPANCY = [0.8, 0.99] as const;
export const BUSY_SOLD_OUT_CHANCE = 0.15; // regular showings that week
export const EXTRA_SOLD_OUT_CHANCE = 0.5; // the added blockbuster showings
// Other dates within two weeks of seeding get lighter, weekend-heavier bookings.
export const LIGHT_WINDOW_DAYS = 14;
export const LIGHT_OCCUPANCY = [0.25, 0.7] as const;
export const WEEKEND_BONUS = 0.1;
export const RANDOM_SEED = 20261125;

/** Fill upcoming showings with demo bookings (see the BUSY_* and LIGHT_* settings above). */
export async function seedDemoBookings(db: DbOrTx): Promise<number> {
  console.log("Creating demo bookings…");
  const random = createRandom(RANDOM_SEED);
  const today = cinemaDate(new Date());
  const lightEnd = cinemaDate(new Date(Date.now() + LIGHT_WINDOW_DAYS * 86_400_000));
  const windowEnd = lightEnd > BUSY_END ? lightEnd : BUSY_END;

  const seatRows = await db
    .select({ id: seats.id, screenId: seats.screenId, rowLabel: seats.rowLabel, number: seats.number, x: seats.x, type: seats.type })
    .from(seats);
  const seatsByScreen = new Map<string, SeedSeat[]>();
  for (const seat of seatRows) seatsByScreen.set(seat.screenId, [...(seatsByScreen.get(seat.screenId) ?? []), seat]);

  const upcoming = await db.execute<{ id: string; screen_id: string; starts_at: Date; local_date: string; local_time: string }>(sql`
    SELECT id, screen_id, starts_at,
           to_char(starts_at AT TIME ZONE ${CINEMA_TIME_ZONE}, 'YYYY-MM-DD') AS local_date,
           to_char(starts_at AT TIME ZONE ${CINEMA_TIME_ZONE}, 'HH24:MI') AS local_time
      FROM showings
     WHERE starts_at > now()
       AND (starts_at AT TIME ZONE ${CINEMA_TIME_ZONE})::date <= ${windowEnd}::date
     ORDER BY starts_at
  `);

  // Seats already sold or held (e.g. bookings you made while testing) are never touched.
  const taken = await db.execute<{ showing_id: string; seat_id: string }>(sql`
    SELECT showing_id, seat_id FROM showing_seats
     WHERE status <> 'available'
       AND showing_id IN (SELECT id FROM showings WHERE starts_at > now())
  `);
  const takenByShowing = new Map<string, Set<string>>();
  for (const t of taken.rows) {
    const set = takenByShowing.get(t.showing_id) ?? new Set<string>();
    set.add(t.seat_id);
    takenByShowing.set(t.showing_id, set);
  }

  const plan = upcoming.rows.flatMap((row) => {
    const isBusy = row.local_date >= BUSY_START && row.local_date <= BUSY_END;
    const isLight = !isBusy && row.local_date >= today && row.local_date <= lightEnd;
    if (!isBusy && !isLight) return [];

    let occupancy: number;
    if (isBusy) {
      const soldOutChance = EXTRA_TIMES.includes(row.local_time) ? EXTRA_SOLD_OUT_CHANCE : BUSY_SOLD_OUT_CHANCE;
      occupancy = random.chance(soldOutChance) ? 1 : random.between(...BUSY_OCCUPANCY);
    } else {
      const weekday = new Date(`${row.local_date}T12:00:00Z`).getUTCDay();
      occupancy = random.between(...LIGHT_OCCUPANCY) + (weekday === 5 || weekday === 6 ? WEEKEND_BONUS : 0);
    }

    const showing: SeedShowing = { id: row.id, screenId: row.screen_id, startsAt: new Date(row.starts_at) };
    const takenHere = takenByShowing.get(row.id);
    const free = (seatsByScreen.get(row.screen_id) ?? []).filter((seat) => !takenHere?.has(seat.id));
    return [{ showing, groups: chooseBookedGroups(free, occupancy, random) }];
  });

  return insertBookings(db, plan, random, await db.select().from(ticketTypes));
}

/**
 * Remove demo bookings that have no seats at all. A real booking always has seats, so
 * these can only be leftovers from a demo seed that stopped part-way. Also removes their
 * demo log entries and unused demo holds. Customer bookings are never touched.
 */
export async function removeBrokenDemoBookings(): Promise<number> {
  return db.transaction(async (tx) => {
    const broken = sql`
      SELECT b.id FROM bookings b JOIN holds h ON h.id = b.hold_id
       WHERE h.session_id = 'seed'
         AND NOT EXISTS (SELECT 1 FROM booking_seats bs WHERE bs.booking_id = b.id)`;
    await tx.execute(sql`DELETE FROM staff_actions WHERE booking_id IN (${broken})`);
    await tx.execute(sql`UPDATE showing_seats SET booking_id = NULL WHERE booking_id IN (${broken})`);
    const removed = await tx.execute(sql`DELETE FROM bookings WHERE id IN (${broken})`);
    await tx.execute(sql`
      DELETE FROM holds h
       WHERE h.session_id = 'seed'
         AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.hold_id = h.id)
         AND NOT EXISTS (SELECT 1 FROM showing_seats ss WHERE ss.hold_id = h.id)`);
    return removed.rowCount ?? 0;
  });
}

const countOf = async (query: ReturnType<typeof sql>) =>
  Number(((await db.execute<{ n: string }>(query)).rows[0] as { n: string } | undefined)?.n ?? 0);

/**
 * Bring the demo up to strength without deleting real data:
 *  - removes broken (seatless) demo bookings left by an interrupted seed,
 *  - adds demo bookings if no booking has seats,
 *  - adds demo staff (with history) if the admin is the only account, or just the staff
 *    booking history if the accounts exist but have none.
 */
export async function topUpDemoData() {
  const removed = await removeBrokenDemoBookings();

  // Demo bookings are the ones the seed made (their holds use the "seed" session).
  const demoWithSeats = await countOf(sql`
    SELECT count(*)::text AS n FROM bookings b JOIN holds h ON h.id = b.hold_id
     WHERE h.session_id = 'seed'
       AND EXISTS (SELECT 1 FROM booking_seats bs WHERE bs.booking_id = b.id)`);
  let demoBookings = `${removed ? `Removed ${removed} broken demo bookings (no seats). ` : ""}`;
  if (demoWithSeats === 0) {
    console.log("No demo bookings yet: adding them around existing ones…");
    const seatsBooked = await db.transaction((tx) => seedDemoBookings(tx));
    demoBookings += `Added demo bookings: ${seatsBooked} seats booked.`;
  } else {
    demoBookings += "Demo bookings already exist: left as they are.";
  }

  const staffCount = await countOf(sql`SELECT count(*)::text AS n FROM staff_users`);
  let demoStaff: string;
  if (staffCount <= 1) {
    console.log("Adding demo staff accounts and their action history…");
    const staff = await seedStaff(createRandom(RANDOM_SEED + 1));
    demoStaff =
      `Added demo staff: ${staff.counts.admin} admins, ${staff.counts.privileged} privileged, ${staff.counts.viewer} viewers, ` +
      `${staff.actions} logged actions. They use ` +
      (staff.demoPassword ? `the password: ${staff.demoPassword}` : "STAFF_DEMO_PASSWORD from .env") + ".";
  } else if ((await countOf(sql`SELECT count(*)::text AS n FROM staff_actions WHERE booking_id IS NOT NULL`)) === 0) {
    console.log("Adding staff booking history…");
    const actions = await seedBookingHistory(createRandom(RANDOM_SEED + 2));
    demoStaff = `Staff accounts kept; added ${actions} booking actions to their history.`;
  } else {
    demoStaff = "Staff accounts already exist: left as they are.";
  }
  return { demoBookings, demoStaff };
}
