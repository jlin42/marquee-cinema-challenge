import type { StaffUser } from "@/server/staff-auth";
import { can, maskEmail } from "@/server/permissions";
import {
  getShowingSeatsWithBookings,
  listAllLocations,
  listScreens,
  listScreenShowings,
  listShowingBookings,
  locateShowing,
  searchBookings,
} from "@/server/staff-dashboard";
import { formatConfirmationCode } from "@/lib/confirmation-code";
import { formatCents } from "@/lib/money";
import { cinemaDate, dateParts, formatTime } from "@/lib/time";

export type OptionVM = { value: string; label: string };

export type StaffSeatVM = {
  id: string;
  label: string;
  x: number;
  y: number;
  isWheelchair: boolean;
  state: "available" | "held" | "sold";
  tooltip: string;
};

export type StaffBookingVM = {
  id: string;
  reference: string;
  customerName: string;
  email: string;
  seats: string; // "E5, E6"
  tickets: string; // "1 Child · 1 General"
  total: string;
  bookedAt: string;
  /** Booked in the last 24 hours (shown with a "New" badge). */
  isRecent: boolean;
  /** Present only for staff allowed to manage bookings. */
  modifyHref: string | null;
};

export type BookingSearchVM = {
  query: string;
  hint: string;
  results: {
    id: string;
    reference: string;
    customerName: string;
    email: string;
    film: string;
    when: string;
    where: string;
    seats: string;
    isCancelled: boolean;
    href: string;
  }[];
};

export type DashboardVM = {
  notice: string | null;
  search: BookingSearchVM;
  canManageBookings: boolean;
  filters: {
    location: string;
    locations: OptionVM[];
    screen: string;
    screens: OptionVM[];
    date: string;
    showing: string;
    showings: OptionVM[];
  };
  showing: {
    title: string; // "Orbit of Ash · 7:45 PM"
    when: string;
    stats: { label: string; value: string }[];
    columns: number;
    rows: { y: number; label: string }[];
    seats: StaffSeatVM[];
    bookings: StaffBookingVM[];
  } | null;
};

const TICKET_LABEL = { general: "General", child: "Child", senior: "Senior" } as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NOTICES: Record<string, string> = { moved: "Booking moved. The change is in the action log." };

export type DashboardParams = {
  location?: string;
  screen?: string;
  date?: string;
  showing?: string;
  showingId?: string;
  notice?: string;
  /** Booking search: confirmation number, name, or email (with contact permission). */
  find?: string;
};

/**
 * Presenter for the staff dashboard. Filters come from the URL; anything invalid falls
 * back to a sensible default. `showingId` opens the dashboard directly on a showing.
 */
export async function getDashboardViewModel(staff: StaffUser, input: DashboardParams): Promise<DashboardVM> {
  const params = { ...input };
  if (params.showingId) {
    const where = await locateShowing(params.showingId);
    if (where) Object.assign(params, { location: where.locationId, screen: where.screenId, date: where.date, showing: params.showingId });
  }

  const locations = await listAllLocations();
  const location = locations.find((l) => l.id === params.location) ?? locations[0];
  const screens = location ? await listScreens(location.id) : [];
  const screen = screens.find((s) => s.id === params.screen) ?? screens[0];
  const date = params.date && DATE.test(params.date) ? params.date : cinemaDate(new Date());

  const showings = screen ? await listScreenShowings(screen.id, date) : [];
  const upcoming = showings.find((s) => s.startsAt.getTime() > Date.now());
  const showing = showings.find((s) => s.id === params.showing) ?? upcoming ?? showings[0];
  const canManage = can(staff, "bookings.manage");
  const showContact = can(staff, "customers.contact");

  return {
    notice: (params.notice && NOTICES[params.notice]) || null,
    search: await toSearchVM(params.find, showContact),
    canManageBookings: canManage,
    filters: {
      location: location?.id ?? "",
      locations: locations.map((l) => ({ value: l.id, label: l.name })),
      screen: screen?.id ?? "",
      screens: screens.map((s) => ({ value: s.id, label: s.name })),
      date,
      showing: showing?.id ?? "",
      showings: showings.map((s) => ({
        value: s.id,
        label: `${formatTime(s.startsAt)} · ${s.filmTitle} · ${s.sold}/${s.capacity}`,
      })),
    },
    showing: showing
      ? await toShowingDetail(showing, {
          showContact: can(staff, "customers.contact"),
          canManage,
          modifyBase: location ? `/staff/movies?location=${location.id}&date=${date}` : "/staff/movies",
        })
      : null,
  };
}

async function toShowingDetail(
  showing: { id: string; startsAt: Date; filmTitle: string; sold: number; capacity: number },
  options: { showContact: boolean; canManage: boolean; modifyBase: string },
) {
  const [seatRows, bookingRows] = await Promise.all([
    getShowingSeatsWithBookings(showing.id),
    listShowingBookings(showing.id),
  ]);

  // Group ticket lines into bookings.
  const byBooking = new Map<string, { name: string; email: string; totalCents: number; createdAt: Date; code: string; seats: string[]; types: string[] }>();
  for (const r of bookingRows) {
    const b = byBooking.get(r.bookingId) ?? {
      name: r.customerName ?? "(no name)",
      email: options.showContact ? r.email : maskEmail(r.email),
      totalCents: r.totalCents,
      createdAt: r.createdAt,
      code: r.confirmationCode,
      seats: [],
      types: [],
    };
    b.seats.push(`${r.rowLabel}${r.number}`);
    b.types.push(TICKET_LABEL[r.ticketType]);
    byBooking.set(r.bookingId, b);
  }

  const revenueCents = [...byBooking.values()].reduce((sum, b) => sum + b.totalCents, 0);
  const held = seatRows.rows.filter((s) => s.status === "held" && s.hold_active).length;
  const percent = showing.capacity ? Math.round((showing.sold / showing.capacity) * 100) : 0;

  const rows = new Map<number, string>();
  for (const s of seatRows.rows) rows.set(s.y, s.row_label);
  const stamp = (d: Date) => {
    const p = dateParts(cinemaDate(d));
    return `${p.weekday} ${p.monthShort} ${p.day}, ${formatTime(d)}`;
  };

  return {
    title: `${showing.filmTitle} · ${formatTime(showing.startsAt)}`,
    when: dateParts(cinemaDate(showing.startsAt)).long,
    stats: [
      { label: "Seats sold", value: `${showing.sold} / ${showing.capacity}` },
      { label: "Full", value: `${percent}%` },
      { label: "Bookings", value: String(byBooking.size) },
      { label: "Revenue", value: formatCents(revenueCents) },
      { label: "Held right now", value: String(held) },
    ],
    columns: seatRows.rows.reduce((max, s) => Math.max(max, s.x + 1), 0),
    rows: [...rows.entries()].sort(([a], [b]) => a - b).map(([y, label]) => ({ y, label })),
    seats: seatRows.rows.map((s): StaffSeatVM => {
      const label = `${s.row_label}${s.number}`;
      const booking = s.booking_id ? byBooking.get(s.booking_id) : undefined;
      const state = s.status === "booked" ? "sold" : s.hold_active ? "held" : "available";
      return {
        id: s.seat_id,
        label,
        x: s.x,
        y: s.y,
        isWheelchair: s.type === "wheelchair",
        state,
        tooltip: booking
          ? `${label} · ${booking.name} · ${booking.email}`
          : `${label} · ${state === "held" ? "held in checkout" : "available"}`,
      };
    }),
    bookings: [...byBooking.entries()].map(([id, b]) => ({
      id,
      reference: formatConfirmationCode(b.code),
      customerName: b.name,
      email: b.email,
      seats: b.seats.join(", "),
      tickets: summarizeTickets(b.types),
      total: formatCents(b.totalCents),
      bookedAt: stamp(b.createdAt),
      isRecent: Date.now() - b.createdAt.getTime() < 24 * 3_600_000,
      modifyHref: options.canManage ? `${options.modifyBase}&modify=${id}` : null,
    })),
  };
}

async function toSearchVM(find: string | undefined, showContact: boolean): Promise<BookingSearchVM> {
  const hint = showContact ? "Confirmation number, name or email" : "Confirmation number or name";
  const query = (find ?? "").trim().slice(0, 80);
  if (query.length < 2) return { query, hint, results: [] };

  const rows = await searchBookings(query, { includeEmail: showContact });
  return {
    query,
    hint,
    results: rows.map((r) => {
      const day = dateParts(cinemaDate(r.startsAt));
      return {
        id: r.id,
        reference: formatConfirmationCode(r.confirmationCode),
        customerName: r.customerName ?? "(no name)",
        email: showContact ? r.email : maskEmail(r.email),
        film: r.filmTitle,
        when: `${day.weekday} ${day.monthShort} ${day.day}, ${formatTime(r.startsAt)}`,
        where: r.where,
        seats: `${r.seats} seat${r.seats === 1 ? "" : "s"}`,
        isCancelled: r.status === "cancelled",
        href: `/staff/dashboard?showingId=${r.showingId}`,
      };
    }),
  };
}

/** ["General", "Child", "General"] → "2 General · 1 Child" */
function summarizeTickets(types: string[]) {
  const counts = new Map<string, number>();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([t, n]) => `${n} ${t}`).join(" · ");
}
