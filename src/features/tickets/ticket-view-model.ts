import { formatCents } from "@/lib/money";
import { cinemaDate, dateParts, formatTime, runtimeLabel } from "@/lib/time";
import type { Ticket } from "@/server/tickets";
import { formatConfirmationCode } from "@/lib/confirmation-code";
import { FAKE_QR_SIZE, fakeQrPath } from "./fake-qr";

export type TicketVM = {
  confirmationCode: string;
  /** "MQ-7F3A-2D9C-41B0": grouped so it's easy to read out at the door. */
  confirmationDisplay: string;
  isCancelled: boolean;
  greeting: string;
  email: string;
  film: { title: string; meta: string; backdropUrl: string | null };
  details: { term: string; value: string }[];
  qr: { path: string; size: number };
  lines: { key: string; label: string; detail: string; amount: string }[];
  subtotal: string | null; // only shown when there's a discount
  discount: { label: string; amount: string } | null;
  total: string;
  paidNote: string;
};

/** Presenter for /bookings/[id]. */
export function toTicketViewModel(t: Ticket): TicketVM {
  const date = dateParts(cinemaDate(t.startsAt));
  const subtotalCents = t.totalCents + t.discountCents;
  const seatList = t.seats.map((s) => s.label).join(", ");
  const code = t.confirmationCode;

  return {
    confirmationCode: code,
    confirmationDisplay: formatConfirmationCode(code),
    isCancelled: t.status === "cancelled",
    greeting: t.customerName ? `Enjoy the show, ${t.customerName.split(" ")[0]}.` : "Enjoy the show.",
    email: t.email,
    film: {
      title: t.film.title,
      meta: [t.film.rating, runtimeLabel(t.film.runtimeMinutes)].filter(Boolean).join(" · "),
      backdropUrl: t.film.backdropUrl,
    },
    details: [
      { term: "Date", value: date.long },
      { term: "Time", value: formatTime(t.startsAt) },
      { term: "Theater", value: t.theater.name },
      { term: "Screen", value: t.screenName },
      { term: t.seats.length === 1 ? "Seat" : `Seats (${t.seats.length})`, value: seatList || "—" },
    ],
    qr: { path: fakeQrPath(code), size: FAKE_QR_SIZE },
    lines: t.seats.map((s) => ({
      key: s.label,
      label: s.label,
      detail: s.type === "wheelchair" ? `${s.ticket} · Wheelchair space` : s.ticket,
      amount: formatCents(s.priceCents + s.feeCents),
    })),
    subtotal: t.discountCents > 0 ? formatCents(subtotalCents) : null,
    discount: t.discountCents > 0 ? { label: `Discount (${t.discountCode})`, amount: `−${formatCents(t.discountCents)}` } : null,
    total: formatCents(t.totalCents),
    paidNote: t.totalCents === 0 ? "No payment was needed." : "Paid (demo: no card was charged).",
  };
}
