/**
 * Seeds demo data: Marquee's 8 Virginia locations × 3 screens, 4 films, and a full
 * schedule of showings from SCHEDULE_START to SCHEDULE_END. Wipes existing data first.
 * Usage: npm run db:seed
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "./client";
import { randomBytes } from "node:crypto";
import { discountCodes, films, locations, screens, seats, showings, ticketTypes } from "./schema";
import { CINEMA_TIME_ZONE, cinemaDate } from "../lib/time";
import { LAYOUTS, parseLayout, type LayoutName } from "./layouts";
import { seedStaff } from "./seed-staff";
import { chooseBookedGroups, createRandom, insertBookings, type SeedSeat, type SeedShowing } from "./seed-bookings";

// Each theater's three screens, by layout (see layouts.ts).
const SCREEN_LAYOUTS: LayoutName[] = ["large", "standard", "small"];

// Schedule: every day in this range, at every theater (cinema-local dates, inclusive).
const SCHEDULE_START = "2026-11-01";
const SCHEDULE_END = "2026-12-31";

// Daily showtimes per screen (cinema-local), staggered so a theater's start times don't collide.
// Three hours apart leaves room for the longest film (2h 22m) plus cleaning.
const SCREEN_SHOWTIMES: string[][] = [
  ["11:00", "14:00", "17:00", "20:00"],
  ["11:30", "14:30", "17:30", "20:30"],
  ["12:15", "15:15", "18:15", "21:15"],
];
const LATE_SHOW = { screen: 0, time: "22:45", weekdays: [5, 6] }; // Fri and Sat

// Demo week (the presentation): extra showtimes of the blockbuster, and busy, partly sold-out houses.
const BUSY_START = "2026-11-25";
const BUSY_END = "2026-12-01";
const EXTRA_SHOWTIMES = [
  { screen: 2, time: "09:30" }, // early show in the small room (ends before its 12:15 show)
  { screen: 1, time: "23:30" }, // late show in the standard room (after its 8:30 show)
];
const EXTRA_TIMES = EXTRA_SHOWTIMES.map((e) => e.time);
const BUSY_OCCUPANCY = [0.8, 0.99] as const;
const BUSY_SOLD_OUT_CHANCE = 0.15; // regular showings that week
const EXTRA_SOLD_OUT_CHANCE = 0.5; // the added blockbuster showings
// Other dates within two weeks of seeding get lighter, weekend-heavier bookings.
const LIGHT_WINDOW_DAYS = 14;
const LIGHT_OCCUPANCY = [0.25, 0.7] as const;
const WEEKEND_BONUS = 0.1;
const RANDOM_SEED = 20261125;

// Most theaters play every film; a few smaller houses skip some (by theater name → film slugs).
// The blockbuster (featured #1) plays everywhere, since the demo week adds extra showings of it.
const LINEUP_EXCLUSIONS: Record<string, string[]> = {
  "Harrisonburg Cinema": ["hollow-pines", "second-chair"],
  "Williamsburg Cinema": ["hollow-pines"],
  "Norfolk Cinema": ["the-quiet-frequency"],
};

/** Convert a wall-clock time in the cinemas' time zone to a UTC instant (handles DST). */
function cinemaTimeToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: CINEMA_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(asIfUtc))
    .find((p) => p.type === "timeZoneName")!.value; // e.g. "GMT-05:00"
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  const offsetMinutes = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(asIfUtc - offsetMinutes * 60_000);
}

function* datesBetween(start: string, end: string) {
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
    yield new Date(t).toISOString().slice(0, 10);
  }
}

async function main() {
  console.log("Clearing existing data…");
  await db.execute(sql`
    TRUNCATE booking_seats, bookings, showing_seats, holds, showings, films, seats, screens,
             staff_actions, staff_sessions, staff_users, locations, ticket_types, discount_codes
    RESTART IDENTITY CASCADE
  `);

  // Price list (cents). The fee is per ticket.
  await db.insert(ticketTypes).values([
    { code: "general", label: "General", description: null, priceCents: 1475, feeCents: 199, sortOrder: 1 },
    { code: "child", label: "Child", description: "3–11 years", priceCents: 1175, feeCents: 199, sortOrder: 2 },
    { code: "senior", label: "Senior", description: "60+ years", priceCents: 1125, feeCents: 199, sortOrder: 3 },
  ]);

  // Discount codes. The 100% comp code comes from .env (gitignored), or is generated and
  // printed, so a free-tickets code never sits in the repo.
  const compCode = (process.env.COMP_DISCOUNT_CODE || `COMP-${randomBytes(4).toString("hex")}`).trim().toUpperCase();
  await db.insert(discountCodes).values([
    { code: compCode, description: "Staff comp", percentOff: 100 },
    { code: "MATINEE20", description: "Matinee special", percentOff: 20 },
    { code: "EXPIRED10", description: "Summer promo", percentOff: 10, expiresAt: new Date("2026-09-01T00:00:00Z") },
  ]);

  const insertedLocations = await db
    .insert(locations)
    // Street addresses are fictional (real cities and ZIP codes).
    .values([
      { name: "Short Pump Cinema", city: "Short Pump, VA", address: "2150 Marquee Way, Glen Allen, VA 23059" },
      { name: "Williamsburg Cinema", city: "Williamsburg, VA", address: "410 Colonial Commons Drive, Williamsburg, VA 23185" },
      { name: "Richmond Cinema", city: "Richmond, VA", address: "1820 Marquee Row, Richmond, VA 23220" },
      { name: "Stony Point Cinema", city: "Richmond, VA", address: "9350 Lantern Court, Richmond, VA 23235" },
      { name: "Harrisonburg Cinema", city: "Harrisonburg, VA", address: "275 Valley Reel Boulevard, Harrisonburg, VA 22801" },
      { name: "Reston Cinema", city: "Reston, VA", address: "1850 Discovery Square, Reston, VA 20190" },
      { name: "Woodbridge Cinema", city: "Woodbridge, VA", address: "1450 Marquee Commons, Woodbridge, VA 22191" },
      { name: "Norfolk Cinema", city: "Norfolk, VA", address: "755 Harborlight Street, Norfolk, VA 23510" },
    ])
    .returning();

  const insertedScreens = await db
    .insert(screens)
    .values(
      insertedLocations.flatMap((loc) =>
        [1, 2, 3].map((n) => ({ locationId: loc.id, name: `Screen ${n}` })),
      ),
    )
    .returning();

  // Seats come from each screen's layout map; x/y is the seat's real position in the room.
  const screenLayouts = new Map(
    insertedLocations.flatMap((loc) =>
      insertedScreens
        .filter((sc) => sc.locationId === loc.id)
        .map((sc, i) => [sc.id, SCREEN_LAYOUTS[i % SCREEN_LAYOUTS.length]!] as const),
    ),
  );
  await db.insert(seats).values(
    insertedScreens.flatMap((screen) =>
      parseLayout(LAYOUTS[screenLayouts.get(screen.id)!]).map((seat) => ({ screenId: screen.id, ...seat })),
    ),
  );

  const insertedFilms = await db
    .insert(films)
    .values([
      {
        slug: "orbit-of-ash",
        title: "Orbit of Ash",
        runtimeMinutes: 142,
        rating: "PG-13",
        genre: "Sci-fi",
        tagline: "The last ship home is already on fire.",
        synopsis:
          "A salvage crew drifting past a dying star finds a distress call from a ship that left Earth two hundred years ago — and a passenger who remembers them.",
        backdropUrl: "/films/orbit-of-ash.svg",
        featuredRank: 1,
      },
      {
        slug: "the-last-projectionist",
        title: "The Last Projectionist",
        runtimeMinutes: 118,
        rating: "PG-13",
        genre: "Drama",
        tagline: "Every reel ends. Not every story does.",
        synopsis:
          "On the final night of a small-town movie palace, its projectionist threads one last film — and the audience starts appearing in it.",
        backdropUrl: "/films/the-last-projectionist.svg",
        featuredRank: 2,
      },
      {
        slug: "paper-lanterns",
        title: "Paper Lanterns",
        runtimeMinutes: 96,
        rating: "PG",
        genre: "Animation",
        tagline: "Light the way. Follow it home.",
        synopsis:
          "A girl who folds lanterns for the river festival discovers each one carries a wish downstream — and someone has been answering them.",
        backdropUrl: "/films/paper-lanterns.svg",
        featuredRank: 3,
      },
      {
        slug: "one-seat-left",
        title: "One Seat Left",
        runtimeMinutes: 104,
        rating: "R",
        genre: "Thriller",
        tagline: "The late show has one seat left. Yours.",
        synopsis:
          "Locked in an old cinema after the midnight screening, five strangers realize the film on screen is showing what happens next.",
        backdropUrl: "/films/one-seat-left.svg",
        featuredRank: 4,
      },
      {
        slug: "saltwater-kings",
        title: "Saltwater Kings",
        runtimeMinutes: 124,
        rating: "PG-13",
        genre: "Adventure",
        tagline: "The bay gives. The bay takes back.",
        synopsis:
          "Two estranged brothers inherit their father's failing oyster boat and one summer to save it, racing a storm, a rival crew and each other across the bay.",
        backdropUrl: "/films/saltwater-kings.svg",
        featuredRank: 5,
      },
      {
        slug: "the-quiet-frequency",
        title: "The Quiet Frequency",
        runtimeMinutes: 109,
        rating: "PG-13",
        genre: "Mystery",
        tagline: "Tonight's caller already knows tomorrow.",
        synopsis:
          "A late-night radio host starts taking calls from a listener who describes tomorrow's headlines in perfect detail — including one about the host.",
        backdropUrl: "/films/the-quiet-frequency.svg",
        featuredRank: null,
      },
      {
        slug: "hollow-pines",
        title: "Hollow Pines",
        runtimeMinutes: 98,
        rating: "R",
        genre: "Horror",
        tagline: "Every night, the trees lean closer.",
        synopsis:
          "A family's fresh start in a mountain cabin unravels when they notice the forest around it moves a little nearer each morning.",
        backdropUrl: "/films/hollow-pines.svg",
        featuredRank: null,
      },
      {
        slug: "second-chair",
        title: "Second Chair",
        runtimeMinutes: 101,
        rating: "PG-13",
        genre: "Comedy",
        tagline: "Always the runner-up. Not this time.",
        synopsis:
          "A violinist who has played second chair for twenty years enters a regional competition — and finds herself up against the student she once taught.",
        backdropUrl: "/films/second-chair.svg",
        featuredRank: null,
      },
      {
        slug: "ember-and-frost",
        title: "Ember & Frost",
        runtimeMinutes: 92,
        rating: "PG",
        genre: "Animation",
        tagline: "Opposites thaw.",
        synopsis:
          "A runaway fire sprite and a stubborn snow spirit must cross the mountains together before the turning of the season traps them both.",
        backdropUrl: "/films/ember-and-frost.svg",
        featuredRank: null,
      },
    ])
    .returning();

  // Screens grouped by theater, so films can rotate by theater, screen, time and day.
  const screensByLocation = insertedLocations.map((loc) => insertedScreens.filter((sc) => sc.locationId === loc.id));
  // Each theater's lineup: every film, minus that theater's exclusions.
  const lineups = insertedLocations.map((loc) => {
    const skip = LINEUP_EXCLUSIONS[loc.name] ?? [];
    return insertedFilms.filter((f) => !f.slug || !skip.includes(f.slug));
  });
  const showingRows: { screenId: string; filmId: string; startsAt: Date }[] = [];
  let dayIndex = 0;
  for (const date of datesBetween(SCHEDULE_START, SCHEDULE_END)) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    screensByLocation.forEach((locScreens, l) => {
      locScreens.forEach((screen, s) => {
        const times = [...(SCREEN_SHOWTIMES[s] ?? SCREEN_SHOWTIMES[0]!)];
        if (s === LATE_SHOW.screen && LATE_SHOW.weekdays.includes(weekday)) times.push(LATE_SHOW.time);
        times.forEach((time, t) => {
          const lineup = lineups[l]!;
          // 12+ slots a day cover the whole lineup, so every film plays daily; the start rotates by day.
          const film = lineup[(l + s * SCREEN_SHOWTIMES[0]!.length + t + dayIndex) % lineup.length]!;
          showingRows.push({ screenId: screen.id, filmId: film.id, startsAt: cinemaTimeToUtc(date, time) });
        });
        // Demo week: extra showings of the blockbuster (featured film #1).
        if (date >= BUSY_START && date <= BUSY_END) {
          for (const extra of EXTRA_SHOWTIMES.filter((e) => e.screen === s)) {
            showingRows.push({ screenId: screen.id, filmId: insertedFilms[0]!.id, startsAt: cinemaTimeToUtc(date, extra.time) });
          }
        }
      });
    });
    dayIndex++;
  }
  console.log(`Creating ${showingRows.length} showings (${SCHEDULE_START} to ${SCHEDULE_END})…`);
  for (let i = 0; i < showingRows.length; i += 1000) {
    await db.insert(showings).values(showingRows.slice(i, i + 1000));
  }

  // Inventory: one available row per seat per showing (one statement, done in the database).
  console.log("Creating seat inventory…");
  await db.execute(sql`
    INSERT INTO showing_seats (showing_id, seat_id)
    SELECT sh.id, se.id
      FROM showings sh
      JOIN seats se ON se.screen_id = sh.screen_id
  `);

  const [{ count }] = (await db.execute<{ count: string }>(
    sql`SELECT count(*)::text AS count FROM showing_seats`,
  )).rows as [{ count: string }];

  const booked = await seedDemoBookings();
  console.log(
    `Seeded ${insertedLocations.length} locations, ${insertedScreens.length} screens, ` +
      `${insertedFilms.length} films, ${showingRows.length} showings, ${count} showing seats, ` +
      `${booked} booked seats.`,
  );

  console.log("Creating staff accounts and their action history…");
  const staff = await seedStaff(createRandom(RANDOM_SEED + 1));
  console.log(
    `Seeded staff: ${staff.counts.admin} admins, ${staff.counts.privileged} privileged, ` +
      `${staff.counts.viewer} viewers, ${staff.actions} logged actions.`,
  );
  console.log(
    `\nStaff sign-in at /staff as "${staff.adminUsername}"` +
      (staff.adminPassword ? ` with password: ${staff.adminPassword}` : " (password from .env)"),
  );
  console.log(
    "Other staff accounts use " +
      (staff.demoPassword ? `the password: ${staff.demoPassword}` : "STAFF_DEMO_PASSWORD from .env") +
      " (usernames are on the Admin tab).",
  );
  console.log(
    `Discount codes: ${process.env.COMP_DISCOUNT_CODE ? "COMP_DISCOUNT_CODE from .env" : compCode} (100% off), ` +
      "MATINEE20 (20% off), EXPIRED10 (expired, for testing).",
  );
}

/** Fill upcoming showings with demo bookings (see the BUSY_* and LIGHT_* settings above). */
async function seedDemoBookings(): Promise<number> {
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
    return [{ showing, groups: chooseBookedGroups(seatsByScreen.get(row.screen_id) ?? [], occupancy, random) }];
  });

  return insertBookings(db, plan, random, await db.select().from(ticketTypes));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
