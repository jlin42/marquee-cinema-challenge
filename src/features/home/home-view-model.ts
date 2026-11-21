import { listFeaturedFilms, type FeaturedFilm } from "@/server/films";
import { getSelectedLocation, listLocations } from "@/server/locations";
import { dayLabel, formatTime, runtimeLabel } from "@/lib/time";

export type ShowtimeLinkVM = { id: string; href: string; title: string; subtitle: string };

export type FilmSlideVM = {
  id: string;
  title: string;
  meta: string[];
  tagline: string | null;
  synopsis: string | null;
  backdropUrl: string | null;
  showtimes: ShowtimeLinkVM[];
  ticketsHref: string | null;
};

export type HomeVM = { slides: FilmSlideVM[] };

/** Presenter: featured films at the visitor's theater, shaped for the hero carousel. */
export async function getHomeViewModel(): Promise<HomeVM> {
  const location = await getSelectedLocation(await listLocations());
  const films = await listFeaturedFilms(location?.id);
  return { slides: films.map(toSlide) };
}

function toSlide(film: FeaturedFilm): FilmSlideVM {
  const showtimes = film.nextShowings.map((s) => ({
    id: s.id,
    href: `/showings/${s.id}`,
    title: `${dayLabel(s.startsAt)} · ${formatTime(s.startsAt)}`,
    subtitle: s.screenName,
  }));
  return {
    id: film.id,
    title: film.title,
    meta: [film.genre, film.rating, runtimeLabel(film.runtimeMinutes)].filter((m): m is string => Boolean(m)),
    tagline: film.tagline,
    synopsis: film.synopsis,
    backdropUrl: film.backdropUrl,
    showtimes,
    ticketsHref: showtimes[0]?.href ?? null,
  };
}
