"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCents } from "@/lib/money";
import { bookingApi, type ApiBooking, type ApiHold, type TicketCode } from "./booking-api";
import type { TicketOptionVM } from "./booking-view-model";
import { seatLabels, toSeatLayout, type SeatLayoutVM, type SeatVM } from "./seat-model";

const REFRESH_MS = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BookingPhase = "select" | "checkout" | "confirmed";
export type Notice = { tone: "info" | "error"; text: string } | null;
export type TicketLineVM = { seatId: string; seat: string; ticket: string; amount: string };

/**
 * View-model hook for booking seats: pick seats (and who sits in each) → hold
 * (checkout) → confirm. The server is the source of truth for seat states and
 * prices; the totals shown here are previews of what the server will charge.
 */
export function useSeatBooking({
  showingId,
  initialLayout,
  initialHold,
  maxSeats,
  ticketOptions,
  theaterConfirmed = false,
}: {
  showingId: string;
  initialLayout: SeatLayoutVM;
  initialHold: ApiHold | null;
  maxSeats: number;
  ticketOptions: TicketOptionVM[];
  theaterConfirmed?: boolean;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [phase, setPhase] = useState<BookingPhase>(initialHold ? "checkout" : "select");
  // Selected seats in the order picked, each with who's sitting there.
  const [tickets, setTickets] = useState<[seatId: string, type: TicketCode][]>(
    () => initialHold?.seatIds.map((id) => [id, "general"]) ?? [],
  );
  const [pendingSeat, setPendingSeat] = useState<SeatVM | null>(null);
  // "Save seat preference": once set, new seats are selected with this type without asking.
  const [preferredType, setPreferredType] = useState<TicketCode | null>(null);
  const [hold, setHold] = useState<ApiHold | null>(initialHold);
  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [hasConfirmedTheater, setHasConfirmedTheater] = useState(theaterConfirmed || initialHold != null);

  const selectedIds = useMemo(() => tickets.map(([id]) => id), [tickets]);
  const optionByCode = useMemo(() => new Map(ticketOptions.map((o) => [o.code, o])), [ticketOptions]);

  // Latest selection, readable from the polling callback without re-creating it.
  const selectedRef = useRef(selectedIds);
  useEffect(() => {
    selectedRef.current = selectedIds;
  }, [selectedIds]);

  /** Pull fresh seat states; drop any selected seat someone else has taken. */
  const refresh = useCallback(async () => {
    const res = await bookingApi.fetchSeats(showingId);
    if (!res.ok) return;
    const next = toSeatLayout(res.data.seats);
    setLayout(next);
    const lost = selectedRef.current.filter((id) => next.seats.find((s) => s.id === id)?.state === "taken");
    if (lost.length > 0) {
      setTickets((current) => current.filter(([id]) => !lost.includes(id)));
      setNotice({ tone: "error", text: `${seatLabels(next.seats, lost).join(", ")} just got taken. Please choose again.` });
    }
  }, [showingId]);

  useEffect(() => {
    if (phase !== "select") return;
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [phase, refresh]);

  // ----- Choosing seats and tickets -----

  /** Clicking a seat: deselect it, select it with the saved preference, or ask who's sitting there. */
  const toggleSeat = (seat: SeatVM) => {
    if (phase !== "select" || seat.state === "taken") return;
    if (selectedIds.includes(seat.id)) {
      setNotice(null);
      setTickets(tickets.filter(([id]) => id !== seat.id));
    } else if (selectedIds.length >= maxSeats) {
      setNotice({ tone: "info", text: `You can book up to ${maxSeats} seats at a time.` });
    } else if (preferredType) {
      setNotice(null);
      setTickets([...tickets, [seat.id, preferredType]]);
    } else {
      setNotice(null);
      setPendingSeat(seat);
    }
  };

  /**
   * Answer "Who is sitting in H9?": selects the seat with that ticket type.
   * With `savePreference`, later seats use the same type automatically.
   */
  const chooseTicket = (type: TicketCode, savePreference: boolean) => {
    if (!pendingSeat) return;
    setTickets([...tickets, [pendingSeat.id, type]]);
    if (savePreference) setPreferredType(type);
    setPendingSeat(null);
  };
  const clearPreference = () => setPreferredType(null);
  const cancelTicket = () => setPendingSeat(null);

  // ----- Prices (previews; the server charges from its own price list) -----

  const lines: TicketLineVM[] = useMemo(() => {
    const labels = new Map(layout.seats.map((s) => [s.id, s.label]));
    return [...tickets]
      .sort(([a], [b]) => (labels.get(a) ?? "").localeCompare(labels.get(b) ?? "", undefined, { numeric: true }))
      .map(([seatId, type]) => {
        const option = optionByCode.get(type);
        return { seatId, seat: labels.get(seatId) ?? "", ticket: option?.label ?? type, amount: option?.total ?? "" };
      });
  }, [tickets, layout.seats, optionByCode]);
  const totalCents = tickets.reduce((sum, [, type]) => sum + (optionByCode.get(type)?.totalCents ?? 0), 0);

  /** The confirmed booking's lines, with the prices the server actually charged. */
  const paidLines: TicketLineVM[] = useMemo(() => {
    if (!booking) return [];
    const labels = new Map(layout.seats.map((s) => [s.id, s.label]));
    return booking.tickets
      .map((t) => ({
        seatId: t.seatId,
        seat: labels.get(t.seatId) ?? "",
        ticket: optionByCode.get(t.ticketType)?.label ?? t.ticketType,
        amount: formatCents(t.priceCents + t.feeCents),
      }))
      .sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true }));
  }, [booking, layout.seats, optionByCode]);

  // ----- Hold, release, expiry, confirm -----

  const holdSeats = async () => {
    if (selectedIds.length === 0 || isBusy) return;
    setIsBusy(true);
    setNotice(null);
    const res = await bookingApi.hold(showingId, selectedIds);
    setIsBusy(false);

    if (res.ok) {
      setHold(res.data.hold);
      setPhase("checkout");
      setLayout((l) => ({ ...l, seats: l.seats.map((s) => (selectedIds.includes(s.id) ? { ...s, state: "mine" } : s)) }));
      return;
    }
    if (res.error.code === "SEAT_CONFLICT") {
      const taken = res.error.seatIds ?? [];
      setTickets((current) => current.filter(([id]) => !taken.includes(id)));
      setNotice({
        tone: "error",
        text: `${seatLabels(layout.seats, taken).join(", ") || "Some seats"} just got taken. Your other seats are still selected.`,
      });
      await refresh();
      return;
    }
    setNotice({ tone: "error", text: res.error.message });
  };

  const changeSeats = async () => {
    if (hold) await bookingApi.release(hold.id);
    setHold(null);
    setPhase("select");
    setNotice(null);
    await refresh();
  };

  const onHoldExpired = useCallback(() => {
    setHold(null);
    setPhase("select");
    setTickets([]);
    setNotice({ tone: "error", text: "Your hold expired and the seats were released. Please pick your seats again." });
    void refresh();
  }, [refresh]);

  const confirm = async (email: string) => {
    if (!hold || isBusy) return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setNotice({ tone: "error", text: "Enter a valid email address for your tickets." });
      return;
    }
    setIsBusy(true);
    setNotice(null);
    const res = await bookingApi.confirm(hold.id, email.trim(), Object.fromEntries(tickets));
    setIsBusy(false);

    if (res.ok) {
      setBooking(res.data.booking);
      setPhase("confirmed");
      return;
    }
    if (res.error.code === "HOLD_EXPIRED") return onHoldExpired();
    setNotice({ tone: "error", text: res.error.message });
  };

  return {
    layout,
    phase,
    needsTheaterConfirmation: phase === "select" && !hasConfirmedTheater,
    confirmTheater: () => setHasConfirmedTheater(true),
    selectedIds,
    selectedLabels: lines.map((l) => l.seat),
    pendingSeat,
    chooseTicket,
    cancelTicket,
    preferredTicketLabel: preferredType ? (optionByCode.get(preferredType)?.label ?? preferredType) : null,
    clearPreference,
    lines,
    total: formatCents(totalCents),
    paidLines,
    paidTotal: booking ? formatCents(booking.totalCents) : null,
    hold,
    booking,
    notice,
    isBusy,
    maxSeats,
    toggleSeat,
    holdSeats,
    changeSeats,
    confirm,
    onHoldExpired,
  };
}
