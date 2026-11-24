"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { CancelBookingButton } from "./cancel-booking-button";
import type { DashboardVM, StaffBookingVM, StaffSeatVM } from "./dashboard-view-model";

type ShowingVM = NonNullable<DashboardVM["showing"]>;

/**
 * View: the seat map (sticky while the page scrolls) beside either all bookings or the
 * one booking whose seat was clicked. Gold = sold, blue = available (as on the customer
 * site), gold outline = held in checkout, white = the booking being looked at.
 */
export function ShowingPanels({ showing, canManage }: { showing: ShowingVM; canManage: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? showing.bookings.find((b) => b.id === selectedId) ?? null : null;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <section aria-label="Seat map" className="rounded-2xl border border-white/10 bg-neutral-950/95 p-5 lg:sticky lg:top-4">
        <StaffSeatMap
          columns={showing.columns}
          rows={showing.rows}
          seats={showing.seats}
          selectedBookingId={selected?.id ?? null}
          // Clicking a seat of the booking already shown deselects it (back to all bookings).
          onSelectBooking={(id) => setSelectedId((current) => (current === id ? null : id))}
        />
        <Legend />
      </section>

      {selected ? (
        <BookingDetail booking={selected} canManage={canManage} onBack={() => setSelectedId(null)} />
      ) : (
        <BookingsTable bookings={showing.bookings} canManage={canManage} onSelect={setSelectedId} />
      )}
    </div>
  );
}

const SEAT_COLOR: Record<StaffSeatVM["state"] | "selected", string> = {
  available: "bg-blue-500 text-blue-950",
  sold: "bg-marquee-500 text-neutral-950 hover:bg-marquee-400 cursor-pointer",
  held: "bg-transparent ring-2 ring-inset ring-marquee-400 text-marquee-400",
  selected: "bg-white text-neutral-950 ring-2 ring-white ring-offset-2 ring-offset-neutral-950 cursor-pointer",
};

function StaffSeatMap({
  columns,
  rows,
  seats,
  selectedBookingId,
  onSelectBooking,
}: {
  columns: number;
  rows: { y: number; label: string }[];
  seats: StaffSeatVM[];
  selectedBookingId: string | null;
  onSelectBooking: (id: string) => void;
}) {
  const seatRows = new Set(rows.map((r) => r.y));
  const lastY = Math.max(-1, ...rows.map((r) => r.y));
  return (
    // Seats scale with the panel (no horizontal scrolling): each column is a fraction of
    // the width, capped at 1.75rem, and seats stay square.
    <div className="mx-auto w-full" style={{ maxWidth: `calc(1.25rem + ${columns} * 1.75rem + ${columns} * 0.25rem)` }}>
      <p aria-hidden className="mx-auto mb-4 w-3/4 border-t-4 border-marquee-400/70 pt-1 text-center text-[11px] uppercase tracking-[0.4em] text-neutral-500">
        Screen
      </p>
      <div
        className="grid w-full gap-[3px] sm:gap-1"
        style={{
          gridTemplateColumns: `1.25rem repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: Array.from({ length: lastY + 1 }, (_, y) => (seatRows.has(y) ? "auto" : "0.75rem")).join(" "),
        }}
      >
        {rows.map((r) => (
          <span key={r.y} aria-hidden className="flex items-center text-[11px] text-neutral-500" style={{ gridColumn: 1, gridRow: r.y + 1 }}>
            {r.label}
          </span>
        ))}
        {seats.map((s) => {
          const isSelected = s.bookingId !== null && s.bookingId === selectedBookingId;
          const color = SEAT_COLOR[isSelected ? "selected" : s.state];
          const base = `flex aspect-square items-center justify-center rounded-t-md rounded-b-sm transition-colors ${color}`;
          const icon = s.isWheelchair && <Icon name="wheelchair" className="h-3/5 w-3/5" />;
          const place = { gridColumn: s.x + 2, gridRow: s.y + 1 };
          return s.bookingId ? (
            <button
              key={s.id}
              type="button"
              title={s.tooltip}
              aria-label={`${s.tooltip}. ${isSelected ? "Show all bookings" : "Show booking"}`}
              aria-pressed={isSelected}
              onClick={() => onSelectBooking(s.bookingId!)}
              style={place}
              className={`${base} ${focusRing}`}
            >
              {icon}
            </button>
          ) : (
            <span key={s.id} title={s.tooltip} aria-label={s.tooltip} style={place} className={base}>
              {icon}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-neutral-400">
      <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-marquee-500" /> Sold</li>
      <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-blue-500" /> Available</li>
      <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm ring-2 ring-inset ring-marquee-400" /> Held in checkout</li>
      <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-white" /> Selected booking</li>
      <li className="text-neutral-500">Click a sold seat to see who booked it</li>
    </ul>
  );
}

function BookingActions({ booking }: { booking: StaffBookingVM }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {booking.modifyHref && (
        <Link
          href={booking.modifyHref}
          className={`rounded-md px-2 py-1 text-xs font-medium text-marquee-400 transition hover:bg-marquee-500/10 ${focusRing}`}
        >
          Modify
        </Link>
      )}
      <CancelBookingButton bookingId={booking.id} reference={booking.reference} />
    </div>
  );
}

function BookingDetail({ booking, canManage, onBack }: { booking: StaffBookingVM; canManage: boolean; onBack: () => void }) {
  return (
    <section aria-labelledby="booking-detail-title" className="w-full min-w-0 max-w-lg">
      <button
        type="button"
        onClick={onBack}
        className={`mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white ${focusRing}`}
      >
        <Icon name="arrow-left" className="h-4 w-4" />
        All bookings
      </button>

      <div className="rounded-xl border border-marquee-400/30 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="booking-detail-title" className="flex items-center gap-2 text-xl font-semibold text-white">
              {booking.customerName}
              {booking.isRecent && (
                <span className="rounded-full bg-marquee-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-marquee-400">New</span>
              )}
            </h2>
            <p className="break-all text-neutral-300">{booking.email}</p>
            <p className="mt-1 text-sm text-neutral-500">Booked {booking.bookedAt}</p>
          </div>
          {canManage && <BookingActions booking={booking} />}
        </div>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-widest text-neutral-500">Confirmation</dt>
            <dd className="mt-1 font-mono text-neutral-200">{booking.reference}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-neutral-500">Seats</dt>
            <dd className="mt-1 text-neutral-200">{booking.seats}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-neutral-500">Total paid</dt>
            <dd className="mt-1 tabular-nums text-neutral-200">{booking.total}</dd>
          </div>
        </dl>

        <h3 className="mt-6 text-xs uppercase tracking-widest text-neutral-500">Tickets</h3>
        <ul className="mt-2 max-w-xs divide-y divide-white/5 rounded-lg border border-white/10 text-sm">
          {booking.lines.map((l) => (
            <li key={l.seat} className="flex items-baseline gap-4 px-4 py-2.5">
              <span className="w-10 shrink-0 font-medium text-white">{l.seat}</span>
              <span className="text-neutral-300">{l.ticket}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BookingsTable({
  bookings,
  canManage,
  onSelect,
}: {
  bookings: StaffBookingVM[];
  canManage: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-labelledby="bookings-title" className="min-w-0">
      <h2 id="bookings-title" className="mb-3 text-lg font-semibold text-white">
        Bookings <span className="text-neutral-500">({bookings.length}, newest first)</span>
      </h2>
      {bookings.length === 0 ? (
        <p className="rounded-xl bg-white/[0.03] px-4 py-8 text-center text-sm text-neutral-400">No bookings yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900 text-xs uppercase tracking-wider text-neutral-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Booker</th>
                <th scope="col" className="px-4 py-3 font-medium">Seats</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                <th scope="col" className="px-4 py-3 font-medium">Confirmation</th>
                {canManage && (
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bookings.map((b) => (
                <tr key={b.id} className="align-top hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelect(b.id)}
                      className={`flex items-center gap-2 text-left font-medium text-white hover:text-marquee-400 ${focusRing}`}
                    >
                      {b.customerName}
                      {b.isRecent && (
                        <span className="rounded-full bg-marquee-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-marquee-400">New</span>
                      )}
                    </button>
                    <p className="break-all text-neutral-400">{b.email}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{b.bookedAt}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-200">{b.seats}</p>
                    <p className="text-xs text-neutral-500">{b.tickets}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-200">{b.total}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">{b.reference}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <BookingActions booking={b} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
