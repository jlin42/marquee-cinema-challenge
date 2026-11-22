import { and, asc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { films, locations, screens, showings } from "@/db/schema";
import { CINEMA_TIME_ZONE } from "@/lib/time";

export type FeaturedFilm = {
  id: string;
  slug: string | null;
  title: string;
  rating: string | null;
  genre: string | null;
  runtimeMinutes: number;
  tagline: string | null;
  synopsis: string | null;
  backdropUrl: string | null;
  nextShowings: {
    id: string;
    startsAt: Date;
    locationName: string;
    screenName: string;
  }[];
};

const SHOWINGS_PER_FILM = 4;
/** The home-page carousel shows at most this many films (lowest featured_rank first). */
export const FEATURED_LIMIT = 5;

/**
 * Films in the home-page carousel, in rank order, each with its next few
 * showings (at one theater when `locationId` is given).
 */
export async function listFeaturedFilms(locationId?: string): Promise<FeaturedFilm[]> {
  const featured = await db
    .select({
      id: films.id,
      slug: films.slug,
      title: films.title,
      rating: films.rating,
      genre: films.genre,
      runtimeMinutes: films.runtimeMinutes,
      tagline: films.tagline,
      synopsis: films.synopsis,
      backdropUrl: films.backdropUrl,
    })
    .from(films)
    .where(isNotNull(films.featuredRank))
    .orderBy(asc(films.featuredRank))
    .limit(FEATURED_LIMIT);
  if (featured.length === 0) return [];

  const upcoming = await db
    .select({
      id: showings.id,
      filmId: showings.filmId,
      startsAt: showings.startsAt,
      locationName: locations.name,
      screenName: screens.name,
    })
    .from(showings)
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .innerJoin(locations, eq(locations.id, screens.locationId))
    .where(
      and(
        inArray(
          showings.filmId,
          featured.map((f) => f.id),
        ),
        gt(showings.startsAt, sql`now()`),
        locationId ? eq(locations.id, locationId) : undefined,
      ),
    )
    .orderBy(asc(showings.startsAt));

  return featured.map((film) => ({
    ...film,
    nextShowings: upcoming
      .filter((s) => s.filmId === film.id)
      .slice(0, SHOWINGS_PER_FILM)
      .map(({ filmId: _filmId, ...s }) => s),
  }));
}

export type FilmWithShowtimes = {
  id: string;
  slug: string | null;
  title: string;
  rating: string | null;
  genre: string | null;
  runtimeMinutes: number;
  backdropUrl: string | null;
  showtimes: { id: string; startsAt: Date; screenName: string; seatsLeft: number }[];
};

/**
 * Every film with at least one upcoming showing at `locationId` on the cinema-local
 * date `date` (YYYY-MM-DD), with those showtimes in order. Started showings are excluded.
 */
export async function listFilmsShowingOn(locationId: string, date: string): Promise<FilmWithShowtimes[]> {
  const rows = await db
    .select({
      filmId: films.id,
      slug: films.slug,
      title: films.title,
      rating: films.rating,
      genre: films.genre,
      runtimeMinutes: films.runtimeMinutes,
      backdropUrl: films.backdropUrl,
      featuredRank: films.featuredRank,
      showingId: showings.id,
      startsAt: showings.startsAt,
      screenName: screens.name,
      seatsLeft: sql<number>`(
        SELECT count(*)::int FROM showing_seats ss
         WHERE ss.showing_id = ${showings.id}
           AND (ss.status = 'available' OR (ss.status = 'held' AND ss.hold_expires_at <= now()))
      )`,
    })
    .from(showings)
    .innerJoin(films, eq(films.id, showings.filmId))
    .innerJoin(screens, eq(screens.id, showings.screenId))
    .where(
      and(
        eq(screens.locationId, locationId),
        gt(showings.startsAt, sql`now()`),
        sql`(${showings.startsAt} AT TIME ZONE ${CINEMA_TIME_ZONE})::date = ${date}::date`,
      ),
    )
    .orderBy(asc(showings.startsAt));

  // Group showings under their film; featured films first, then by title.
  const byFilm = new Map<string, FilmWithShowtimes & { rank: number }>();
  for (const r of rows) {
    let film = byFilm.get(r.filmId);
    if (!film) {
      film = {
        id: r.filmId,
        slug: r.slug,
        title: r.title,
        rating: r.rating,
        genre: r.genre,
        runtimeMinutes: r.runtimeMinutes,
        backdropUrl: r.backdropUrl,
        rank: r.featuredRank ?? Number.MAX_SAFE_INTEGER,
        showtimes: [],
      };
      byFilm.set(r.filmId, film);
    }
    film.showtimes.push({ id: r.showingId, startsAt: r.startsAt, screenName: r.screenName, seatsLeft: r.seatsLeft });
  }
  return [...byFilm.values()]
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
    .map(({ rank: _rank, ...film }) => film);
}

/** Cinema-local dates (YYYY-MM-DD) that still have upcoming showings at a theater, in order. */
export async function listShowDates(locationId: string): Promise<string[]> {
  const rows = await db.execute<{ d: string }>(sql`
    SELECT DISTINCT to_char(${showings.startsAt} AT TIME ZONE ${CINEMA_TIME_ZONE}, 'YYYY-MM-DD') AS d
      FROM ${showings}
      JOIN ${screens} ON ${screens.id} = ${showings.screenId}
     WHERE ${screens.locationId} = ${locationId}::uuid
       AND ${showings.startsAt} > now()
     ORDER BY d
  `);
  return rows.rows.map((r) => r.d);
}
