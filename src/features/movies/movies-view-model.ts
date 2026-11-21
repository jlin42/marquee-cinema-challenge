import { listFilmsShowingOn, listShowDates, type FilmWithShowtimes } from "@/server/films";
import { getSelectedLocation, listLocations } from "@/server/locations";
import { cinemaDateFromToday, dateParts, formatTime } from "@/lib/time";
import { toDateChips, type DateChipVM } from "@/components/date-strip/date-chips";

const FEW_SEATS = 15;

export type ShowtimeVM = {
  id: string;
  time: string;
  detail: string; // screen name, "12 seats left" or "Sold out"
  tone: "default" | "low" | "soldOut";
  href: string | null; // null when sold out
  ariaLabel: string;
};

export type FilmCardVM = {
  id: string;
  title: string;
  meta: string[];
  posterUrl: string | null;
  ticketsHref: string | null;
  showtimes: ShowtimeVM[];
};

export type MoviesVM = {
  subtitle: { name: string; city: string } | null;
  dates: DateChipVM[];
  selectedDateLabel: string;
  films: FilmCardVM[];
  empty: { message: string; next: { href: string; label: string } | null } | null;
};

/** Presenter for /movies: the date strip and the day's film cards at the visitor's theater. */
export async function getMoviesViewModel(requestedDate?: string): Promise<MoviesVM> {
  const location = await getSelectedLocation(await listLocations());
  const showDates = location ? await listShowDates(location.id) : [];
  const date = showDates.includes(requestedDate ?? "") ? requestedDate! : (showDates[0] ?? cinemaDateFromToday(0));
  const films = location ? await listFilmsShowingOn(location.id, date) : [];
  const selectedDateLabel = dateParts(date).long;

  const nextDate = showDates[showDates.indexOf(date) + 1];
  return {
    subtitle: location ? { name: location.name, city: location.city } : null,
    dates: toDateChips(showDates, date, (d) => dateHref(d, showDates)),
    selectedDateLabel,
    films: films.map(toFilmCard),
    empty:
      films.length > 0
        ? null
        : {
            message: `No showtimes on ${selectedDateLabel}${location ? ` at ${location.name}` : ""}.`,
            next: nextDate ? { href: dateHref(nextDate, showDates), label: "See the next day’s showtimes" } : null,
          },
  };
}

const dateHref = (date: string, all: string[]) => (date === all[0] ? "/movies" : `/movies?date=${date}`);

function toFilmCard(film: FilmWithShowtimes): FilmCardVM {
  const showtimes = film.showtimes.map(toShowtime);
  return {
    id: film.id,
    title: film.title,
    meta: [film.rating, `${film.runtimeMinutes} min`, film.genre].filter((m): m is string => Boolean(m)),
    posterUrl: film.backdropUrl,
    ticketsHref: showtimes.find((s) => s.href)?.href ?? null,
    showtimes,
  };
}

function toShowtime(s: FilmWithShowtimes["showtimes"][number]): ShowtimeVM {
  const time = formatTime(s.startsAt);
  if (s.seatsLeft === 0) {
    return { id: s.id, time, detail: "Sold out", tone: "soldOut", href: null, ariaLabel: `${time}, ${s.screenName}, sold out` };
  }
  const low = s.seatsLeft <= FEW_SEATS;
  return {
    id: s.id,
    time,
    detail: low ? `${s.seatsLeft} seats left` : s.screenName,
    tone: low ? "low" : "default",
    href: `/showings/${s.id}`,
    ariaLabel: `${time}, ${s.screenName}${low ? `, ${s.seatsLeft} seats left` : ""}`,
  };
}
