/**
 * Seeds demo data: 2 locations × 3 screens, 4 films, and showings for today
 * and tomorrow. Wipes existing data first. Usage: npm run db:seed
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "./client";
import { films, locations, screens, seats, showings } from "./schema";

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

const SHOWTIMES = ["13:00", "16:30", "19:45"]; // local time, per screen per day

async function main() {
  console.log("Clearing existing data…");
  await db.execute(sql`
    TRUNCATE booking_seats, bookings, showing_seats, holds, showings, films, seats, screens, locations
    RESTART IDENTITY CASCADE
  `);

  const insertedLocations = await db
    .insert(locations)
    .values([
      { name: "Marquee Downtown", city: "Indianapolis" },
      { name: "Marquee Riverside", city: "Carmel" },
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
            type: row === ROWS.at(-1) ? (ACCESSIBLE[number] ?? "standard") : "standard",
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
      { title: "The Last Projectionist", runtimeMinutes: 118, rating: "PG-13" },
      { title: "Orbit of Ash", runtimeMinutes: 142, rating: "PG-13" },
      { title: "Paper Lanterns", runtimeMinutes: 96, rating: "PG" },
      { title: "Midnight at the Marquee", runtimeMinutes: 104, rating: "R" },
    ])
    .returning();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const showingRows = insertedScreens.flatMap((screen, s) =>
    [0, 1].flatMap((dayOffset) =>
      SHOWTIMES.map((time, t) => {
        const [h, m] = time.split(":").map(Number);
        const startsAt = new Date(today);
        startsAt.setDate(startsAt.getDate() + dayOffset);
        startsAt.setHours(h ?? 0, m ?? 0);
        const film = insertedFilms[(s + t) % insertedFilms.length]!;
        return { screenId: screen.id, filmId: film.id, startsAt };
      }),
    ),
  );
  await db.insert(showings).values(showingRows);

  // Inventory: one available row per seat per showing.
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
