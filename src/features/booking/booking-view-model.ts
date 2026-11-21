import { getSeatMap, MAX_SEATS_PER_HOLD } from "@/server/booking";
import { listTicketTypes } from "@/server/pricing";
import { formatCents } from "@/lib/money";
import { readSessionId } from "@/server/session";
import { getActiveHold, getShowing, listFilmShowtimesAtLocation } from "@/server/showings";
import { toDateChips, type DateChipVM } from "@/components/date-strip/date-chips";
import type { IconName } from "@/components/ui/icon";
import { dateParts, cinemaDate, formatTime, runtimeLabel } from "@/lib/time";
import type { ApiHold } from "./booking-api";
import { toSeatLayout, type SeatLayoutVM } from "./seat-model";

export type TicketOptionVM = {
  code: "general" | "child" | "senior";
  label: string; // "Child"
  totalCents: number; // price + fee
  total: string; // "$13.74"
  breakdown: string; // "$11.75 + $1.99 fee"
};

export type DetailVM = { icon: IconName; text: string; label: string };

export type ShowtimeChipVM = {
  id: string;
  time: string; // "7:45 PM"
  href: string | null; // null when sold out
  isCurrent: boolean;
  ariaLabel: string;
};

export type ShowtimePickerVM = { dates: DateChipVM[]; times: ShowtimeChipVM[] };

export type BookingVM = {
  showingId: string;
  film: { title: string; backdropUrl: string | null };
  /** Rating, runtime, theater and screen, each with an icon. */
  details: DetailVM[];
  /** Other dates and times for this film at this theater. */
  showtimes: ShowtimePickerVM;
  /** Skip the theater confirmation (switching showtimes within the same theater). */
  theaterConfirmed: boolean;
  when: string; // "Saturday, November 21 · 7:45 PM"
  where: string; // "Norfolk Cinema · Screen 2"
  theater: { name: string; address: string };
  /** Back to this day's showtimes. */
  showtimesHref: string;
  hasStarted: boolean;
  layout: SeatLayoutVM;
  /** The visitor's unconfirmed hold, so a refresh mid-checkout resumes it. */
  activeHold: ApiHold | null;
  maxSeats: number;
  ticketOptions: TicketOptionVM[];
  /** "Child 3–11 years. Senior 60+ years." */
  ticketNote: string;
};

/**
 * Presenter for /showings/[id]. Returns null when the showing doesn't exist.
 * `date` picks which day's showtimes to list (default: this showing's day).
 */
export async function getBookingViewModel(
  showingId: string,
  options: { date?: string; theaterConfirmed?: boolean } = {},
): Promise<BookingVM | null> {
  const showing = await getShowing(showingId);
  if (!showing) return null;
  const showingDate = cinemaDate(showing.startsAt);

  const sessionId = await readSessionId();
  const [seats, hold, priceList, filmShowtimes] = await Promise.all([
    getSeatMap(showingId, sessionId),
    sessionId ? getActiveHold(showingId, sessionId) : null,
    listTicketTypes(),
    listFilmShowtimesAtLocation(showing.film.id, showing.location.id),
  ]);

  return {
    showingId,
    film: { title: showing.film.title, backdropUrl: showing.film.backdropUrl },
    details: [
      ...(showing.film.rating ? [{ icon: "rating" as const, text: showing.film.rating, label: "Rated" }] : []),
      { icon: "clock", text: runtimeLabel(showing.film.runtimeMinutes), label: "Runtime" },
      { icon: "pin", text: showing.location.name, label: "Theater" },
      { icon: "screen", text: showing.screen.name, label: "Auditorium" },
    ],
    showtimes: toShowtimePicker(showingId, showingDate, options.date, filmShowtimes),
    theaterConfirmed: options.theaterConfirmed ?? false,
    when: `${dateParts(cinemaDate(showing.startsAt)).long} · ${formatTime(showing.startsAt)}`,
    where: `${showing.location.name} · ${showing.screen.name}`,
    theater: { name: showing.location.name, address: showing.location.address ?? showing.location.city },
    showtimesHref: `/movies?date=${cinemaDate(showing.startsAt)}`,
    hasStarted: showing.startsAt.getTime() <= Date.now(),
    layout: toSeatLayout(seats),
    activeHold: hold
      ? { id: hold.id, showingId, seatIds: hold.seatIds, expiresAt: hold.expiresAt.toISOString() }
      : null,
    maxSeats: MAX_SEATS_PER_HOLD,
    ticketOptions: priceList.map((t) => ({
      code: t.code,
      label: t.label,
      totalCents: t.priceCents + t.feeCents,
      total: formatCents(t.priceCents + t.feeCents),
      breakdown: `${formatCents(t.priceCents)} + ${formatCents(t.feeCents)} fee`,
    })),
    ticketNote: priceList
      .filter((t) => t.description)
      .map((t) => `${t.label} ${t.description}.`)
      .join(" "),
  };
}

type FilmShowtime = Awaited<ReturnType<typeof listFilmShowtimesAtLocation>>[number];

/** Dates and times for this film at this theater. Picking a date stays on this showing. */
function toShowtimePicker(
  showingId: string,
  showingDate: string,
  requestedDate: string | undefined,
  showtimes: FilmShowtime[],
): ShowtimePickerVM {
  const byDate = new Map<string, FilmShowtime[]>();
  for (const s of showtimes) {
    const date = cinemaDate(s.startsAt);
    byDate.set(date, [...(byDate.get(date) ?? []), s]);
  }
  const dates = [...byDate.keys()];
  const selected = requestedDate && byDate.has(requestedDate) ? requestedDate : showingDate;

  // Interacting here means the theater is already confirmed, so links skip the modal.
  const here = `/showings/${showingId}`;
  return {
    dates: toDateChips(dates, selected, (d) => (d === showingDate ? `${here}?confirmed=1` : `${here}?date=${d}&confirmed=1`)),
    times: (byDate.get(selected) ?? []).map((s) => {
      const time = formatTime(s.startsAt);
      const soldOut = s.seatsLeft === 0;
      return {
        id: s.id,
        time,
        href: soldOut ? null : `/showings/${s.id}?confirmed=1`,
        isCurrent: s.id === showingId,
        ariaLabel: `${time}, ${s.screenName}${soldOut ? ", sold out" : ""}${s.id === showingId ? ", current showing" : ""}`,
      };
    }),
  };
}
