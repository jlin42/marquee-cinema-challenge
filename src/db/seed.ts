/**
 * Seeds demo data: Marquee's 8 Virginia locations × 3 screens, 4 films, and a full
 * schedule of showings from SCHEDULE_START to SCHEDULE_END. Wipes existing data first.
 * Usage: npm run db:seed
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "./client";
import { films, locations, screens, seats, showings } from "./schema";
import { CINEMA_TIME_ZONE } from "../lib/time";

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const SEATS_PER_ROW = 12;
const AISLE_AFTER = 6; // gap in the seat map between seats 6 and 7

// Accessible seating on the last row (row H, by the entrance): each wheelchair
// space sits next to a companion seat.
const ACCESSIBLE: Record<number, "wheelchair" | "companion"> = {
  1: "wheelchair",
  2: "companion",
  11: "companion",
  12: "wheelchair",
};

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
    TRUNCATE booking_seats, bookings, showing_seats, holds, showings, films, seats, screens, locations
    RESTART IDENTITY CASCADE
  `);

  const insertedLocations = await db
    .insert(locations)
    .values([
      { name: "Short Pump Cinema", city: "Short Pump, VA" },
      { name: "Williamsburg Cinema", city: "Williamsburg, VA" },
      { name: "Richmond Cinema", city: "Richmond, VA" },
      { name: "Stony Point Cinema", city: "Richmond, VA" },
      { name: "Harrisonburg Cinema", city: "Harrisonburg, VA" },
      { name: "Reston Cinema", city: "Reston, VA" },
      { name: "Woodbridge Cinema", city: "Woodbridge, VA" },
      { name: "Norfolk Cinema", city: "Norfolk, VA" },
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

  await db.insert(seats).values(
    insertedScreens.flatMap((screen) =>
      ROWS.flatMap((row, y) =>
        Array.from({ length: SEATS_PER_ROW }, (_, i) => {
          const number = i + 1;
          return {
            screenId: screen.id,
            rowLabel: row,
            number,
            type: row === ROWS.at(-1) ? (ACCESSIBLE[number] ?? ("standard" as const)) : ("standard" as const),
            x: number + (number > AISLE_AFTER ? 1 : 0),
            y,
          };
        }),
      ),
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
        slug: "midnight-at-the-marquee",
        title: "Midnight at the Marquee",
        runtimeMinutes: 104,
        rating: "R",
        genre: "Thriller",
        tagline: "The late show has one seat left. Yours.",
        synopsis:
          "Locked in an old cinema after the midnight screening, five strangers realize the film on screen is showing what happens next.",
        backdropUrl: "/films/midnight-at-the-marquee.svg",
        featuredRank: 4,
      },
    ])
    .returning();

  // Screens grouped by theater, so films can rotate by theater, screen, time and day.
  const screensByLocation = insertedLocations.map((loc) => insertedScreens.filter((sc) => sc.locationId === loc.id));
  const showingRows: { screenId: string; filmId: string; startsAt: Date }[] = [];
  let dayIndex = 0;
  for (const date of datesBetween(SCHEDULE_START, SCHEDULE_END)) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    screensByLocation.forEach((locScreens, l) => {
      locScreens.forEach((screen, s) => {
        const times = [...(SCREEN_SHOWTIMES[s] ?? SCREEN_SHOWTIMES[0]!)];
        if (s === LATE_SHOW.screen && LATE_SHOW.weekdays.includes(weekday)) times.push(LATE_SHOW.time);
        times.forEach((time, t) => {
          const film = insertedFilms[(l + s * 2 + t + dayIndex) % insertedFilms.length]!;
          showingRows.push({ screenId: screen.id, filmId: film.id, startsAt: cinemaTimeToUtc(date, time) });
        });
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
  console.log(
    `Seeded ${insertedLocations.length} locations, ${insertedScreens.length} screens, ` +
      `${insertedFilms.length} films, ${showingRows.length} showings, ${count} showing seats.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
