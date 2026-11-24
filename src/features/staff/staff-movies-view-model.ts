import { formatConfirmationCode } from "@/lib/confirmation-code";
import { toDateChips, type DateChipVM } from "@/components/date-strip/date-chips";
import { toSeatLayout, type SeatLayoutVM } from "@/features/booking/seat-model";
import { getSeatMap } from "@/server/booking";
import { listFilmsShowingOn, listShowDates } from "@/server/films";
import { getBookingForModify, getShowingHeading, getShowingSeatsWithBookings, listAllLocations } from "@/server/staff-dashboard";
import { cinemaDate, cinemaDateFromToday, dateParts, formatTime } from "@/lib/time";
import type { OptionVM } from "./dashboard-view-model";

export type ModifyingVM = { bookingId: string; reference: string; customer: string; seatCount: number; seats: string; current: string };

export type StaffMoviesVM = {
  modifying: ModifyingVM | null;
  location: string;
  locations: OptionVM[];
  dates: DateChipVM[];
  dateLabel: string;
  films: {
    id: string;
    title: string;
    meta: string;
    /** Film artwork, shown as a thumbnail. */
    posterUrl: string | null;
    showtimes: { id: string; time: string; detail: string; href: string; isFull: boolean }[];
  }[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function toModifying(bookingId?: string): Promise<(ModifyingVM & { showingId: string; seatIds: string[] }) | null> {
  if (!bookingId) return null;
  const b = await getBookingForModify(bookingId);
  if (!b) return null;
  return {
    bookingId: b.id,
    reference: formatConfirmationCode(b.confirmationCode),
    customer: b.customerName ?? b.email,
    seatCount: b.seatIds.length,
    seats: b.seatLabels.join(", "),
    current: b.where,
    showingId: b.showingId,
    seatIds: b.seatIds,
  };
}

/** Presenter for the staff Movies tab: showtimes by theater and date (no landing carousel). */
export async function getStaffMoviesViewModel(params: { location?: string; date?: string; modify?: string }): Promise<StaffMoviesVM> {
  const modifying = await toModifying(params.modify);
  const locations = await listAllLocations();
  const location = locations.find((l) => l.id === params.location) ?? locations[0];
  const showDates = location ? await listShowDates(location.id) : [];
  const date = params.date && DATE.test(params.date) && showDates.includes(params.date) ? params.date : (showDates[0] ?? cinemaDateFromToday(0));
  const films = location ? await listFilmsShowingOn(location.id, date) : [];
  const keep = modifying ? `&modify=${modifying.bookingId}` : "";

  return {
    modifying: modifying && { ...modifying },
    location: location?.id ?? "",
    locations: locations.map((l) => ({ value: l.id, label: l.name })),
    dates: toDateChips(showDates, date, (d) => `/staff/movies?location=${location?.id}&date=${d}${keep}`),
    dateLabel: dateParts(date).long,
    films: films.map((f) => ({
      id: f.id,
      title: f.title,
      meta: [f.rating, `${f.runtimeMinutes} min`, f.genre].filter(Boolean).join(" · "),
      posterUrl: f.backdropUrl,
      showtimes: f.showtimes.map((s) => ({
        id: s.id,
        time: formatTime(s.startsAt),
        detail: s.seatsLeft === 0 ? `${s.screenName} · full` : `${s.screenName} · ${s.seatsLeft} left`,
        href: `/staff/movies/${s.id}${modifying ? `?modify=${modifying.bookingId}` : ""}`,
        isFull: s.seatsLeft === 0,
      })),
    })),
  };
}

export type StaffSeatPickerVM = {
  showingId: string;
  title: string;
  when: string;
  where: string;
  backHref: string;
  layout: SeatLayoutVM;
  modifying: ModifyingVM | null;
  /** Seats preselected (the booking's current seats when it's in this showing). */
  initialSelection: string[];
  /** Booked seat id → its booking id, so clicking a booked seat opens it for modifying. */
  bookingBySeat: Record<string, string>;
};

/** Presenter for the staff seat picker. The booking's own seats count as choosable. */
export async function getStaffSeatPickerViewModel(showingId: string, modify?: string): Promise<StaffSeatPickerVM | null> {
  const heading = await getShowingHeading(showingId);
  if (!heading) return null;
  const modifying = await toModifying(modify);
  const date = cinemaDate(heading.startsAt);

  const [map, seatBookings] = await Promise.all([getSeatMap(showingId), getShowingSeatsWithBookings(showingId)]);
  const layout = toSeatLayout(map);
  const bookingBySeat = Object.fromEntries(
    seatBookings.rows.filter((r) => r.status === "booked" && r.booking_id).map((r) => [r.seat_id, r.booking_id!]),
  );
  const ownSeats = modifying && modifying.showingId === showingId ? modifying.seatIds : [];
  const seats = layout.seats.map((s) => (ownSeats.includes(s.id) ? { ...s, state: "available" as const } : s));

  return {
    showingId,
    title: heading.title,
    when: `${dateParts(date).long} · ${formatTime(heading.startsAt)}`,
    where: heading.where,
    backHref: `/staff/movies?location=${heading.locationId}&date=${date}${modifying ? `&modify=${modifying.bookingId}` : ""}`,
    layout: { ...layout, seats },
    modifying: modifying && {
      bookingId: modifying.bookingId,
      reference: modifying.reference,
      customer: modifying.customer,
      seatCount: modifying.seatCount,
      seats: modifying.seats,
      current: modifying.current,
    },
    initialSelection: ownSeats,
    bookingBySeat,
  };
}
