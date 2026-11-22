/**
 * Demo data: Marquee's 8 Virginia locations × 3 screens, the films, a full schedule of
 * showings from SCHEDULE_START to SCHEDULE_END, demo bookings, staff and their history.
 *
 *   npm run db:seed    safe: builds the demo on an empty database; otherwise only adds
 *                      missing reference data and keeps everything else
 *   npm run db:reset   wipes and rebuilds everything (asks first; all-or-nothing)
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { db, pool, type DbOrTx } from "./client";
import { hashPassword } from "../server/passwords";
import { randomBytes } from "node:crypto";
import { discountCodes, films, locations, screens, seats, showings, staffUsers, ticketTypes } from "./schema";
import { CINEMA_TIME_ZONE } from "../lib/time";
import { LAYOUTS, parseLayout, type LayoutName } from "./layouts";
import { seedStaff } from "./seed-staff";
import { BUSY_END, BUSY_START, EXTRA_SHOWTIMES, RANDOM_SEED, seedDemoBookings, topUpDemoData } from "./demo-data";
import { createRandom } from "./seed-bookings";

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



// Most theaters play every film; a few smaller houses skip some (by theater name → film slugs).
// The blockbuster (featured #1) plays everywhere, since the demo week adds extra showings of it.
const LINEUP_EXCLUSIONS: Record<string, string[]> = {
  "Harrisonburg Cinema": ["hollow-pines", "second-chair"],
  "Williamsburg Cinema": ["hollow-pines"],
  "Norfolk Cinema": ["the-quiet-frequency"],
};

// Price list (cents). The fee is per ticket.
const TICKET_TYPES = [
  { code: "general", label: "General", description: null, priceCents: 1475, feeCents: 199, sortOrder: 1 },
  { code: "child", label: "Child", description: "3–11 years", priceCents: 1175, feeCents: 199, sortOrder: 2 },
  { code: "senior", label: "Senior", description: "60+ years", priceCents: 1125, feeCents: 199, sortOrder: 3 },
] satisfies (typeof ticketTypes.$inferInsert)[];

// Films, in carousel order. `slug` is the stable key used to refresh details later.
const FILMS = [
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
] satisfies (typeof films.$inferInsert & { slug: string })[];

/**
 * Discount codes. The 100% comp code comes from COMP_DISCOUNT_CODE in .env (gitignored),
 * or is generated and printed, so a free-tickets code never sits in the repo.
 */
function discountCodeRows() {
  const compCode = (process.env.COMP_DISCOUNT_CODE || `COMP-${randomBytes(4).toString("hex")}`).trim().toUpperCase();
  return {
    compCode,
    rows: [
      { code: compCode, description: "Staff comp", percentOff: 100 },
      { code: "MATINEE20", description: "Matinee special", percentOff: 20 },
      { code: "EXPIRED10", description: "Summer promo", percentOff: 10, expiresAt: new Date("2026-09-01T00:00:00Z") },
    ] satisfies (typeof discountCodes.$inferInsert)[],
  };
}

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

/**
 * `npm run db:seed`: safe. On an empty database it builds the demo; on one that already
 *   has data it only adds missing reference data (prices, discount codes, film details,
 *   the admin account) and keeps every booking, staff account and log entry.
 * `npm run db:reset`: wipes everything and rebuilds the demo (asks to confirm first).
 *   The rebuild runs in one transaction, so a failure part-way loses nothing.
 */
async function main() {
  const reset = process.argv.includes("--reset");
  const [{ n }] = (await db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM locations`)).rows as [{ n: string }];
  const hasData = Number(n) > 0;

  if (hasData && !reset) {
    await syncReferenceData();
    return;
  }
  if (hasData && reset && !process.argv.includes("--yes") && !(await confirmReset())) {
    console.log("Cancelled. Nothing was changed.");
    return;
  }

  console.log(hasData ? "Rebuilding the demo (one transaction: all or nothing)…" : "Building the demo…");
  const { compCode } = await db.transaction((tx) => buildWorld(tx));

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

/** Ask before wiping a database that has data (bookings made while testing would be lost). */
async function confirmReset(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "This deletes ALL bookings (including ones you made), staff accounts and the action log,\n" +
      "then rebuilds the demo. Type RESET to continue: ",
  );
  rl.close();
  return answer.trim() === "RESET";
}

/**
 * Non-destructive top-up for a database that already has data: adds or updates the
 * price list, adds missing discount codes, refreshes film details by slug, and makes
 * sure the admin account from .env exists. Never deletes anything.
 */
async function syncReferenceData() {
  console.log("Database already has data: keeping it. Adding anything missing…");

  for (const t of TICKET_TYPES) {
    await db
      .insert(ticketTypes)
      .values(t)
      .onConflictDoUpdate({ target: ticketTypes.code, set: { label: t.label, description: t.description, priceCents: t.priceCents, feeCents: t.feeCents, sortOrder: t.sortOrder } });
  }

  const codes = discountCodeRows();
  const addedCodes = await db.insert(discountCodes).values(codes.rows).onConflictDoNothing().returning({ code: discountCodes.code });

  let filmsUpdated = 0;
  const missingFilms: string[] = [];
  for (const f of FILMS) {
    const updated = await db
      .update(films)
      .set({ title: f.title, runtimeMinutes: f.runtimeMinutes, rating: f.rating, genre: f.genre, tagline: f.tagline, synopsis: f.synopsis, backdropUrl: f.backdropUrl, featuredRank: f.featuredRank })
      .where(eq(films.slug, f.slug))
      .returning({ id: films.id });
    if (updated.length) filmsUpdated++;
    else missingFilms.push(f.title);
  }

  const admin = await ensureAdmin();

  const { demoBookings, demoStaff } = await topUpDemoData();

  console.log(`Price list up to date. Discount codes added: ${addedCodes.map((c) => c.code).join(", ") || "none (all present)"}.`);
  console.log(`Film details refreshed: ${filmsUpdated}.`);
  if (missingFilms.length) {
    console.log(`Not in this database yet (they need showtimes, so run npm run db:reset to add them): ${missingFilms.join(", ")}.`);
  }
  console.log(admin);
  console.log(demoBookings);
  console.log(demoStaff);
  console.log("Nothing was deleted.");
}

/** Create the .env admin if it's missing. An existing account is left exactly as it is. */
async function ensureAdmin(): Promise<string> {
  const username = process.env.STAFF_ADMIN_USERNAME?.trim();
  const password = process.env.STAFF_ADMIN_PASSWORD;
  if (!username || !password) return "Admin account: STAFF_ADMIN_USERNAME / STAFF_ADMIN_PASSWORD not set in .env, skipped.";
  const [existing] = await db.select({ id: staffUsers.id }).from(staffUsers).where(sql`lower(${staffUsers.username}) = lower(${username})`);
  if (existing) return `Admin account "${username}" exists (unchanged; npm run staff:reset-admin resets it).`;
  await db.insert(staffUsers).values({ username, name: username, passwordHash: await hashPassword(password), role: "admin" });
  return `Admin account "${username}" was missing: created it with the password from .env.`;
}

/**
 * Build the whole demo world from scratch: wipes every table first. Runs inside one
 * transaction (see main), so if anything fails the database is left exactly as it was.
 */
async function buildWorld(db: DbOrTx) {
  console.log("Clearing existing data…");
  await db.execute(sql`
    TRUNCATE booking_seats, bookings, showing_seats, holds, showings, films, seats, screens,
             staff_actions, staff_sessions, staff_users, locations, ticket_types, discount_codes
    RESTART IDENTITY CASCADE
  `);

  // Price list (cents). The fee is per ticket.
  await db.insert(ticketTypes).values(TICKET_TYPES);

  // Discount codes (the 100% comp code comes from .env, or is generated and printed).
  const codes = discountCodeRows();
  await db.insert(discountCodes).values(codes.rows);
  const compCode = codes.compCode;

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
    .values(FILMS)
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

  const booked = await seedDemoBookings(db);
  console.log(
    `Seeded ${insertedLocations.length} locations, ${insertedScreens.length} screens, ` +
      `${insertedFilms.length} films, ${showingRows.length} showings, ${count} showing seats, ` +
      `${booked} booked seats.`,
  );
  return { compCode };
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
