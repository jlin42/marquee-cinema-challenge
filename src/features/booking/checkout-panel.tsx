"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { useCountdown } from "@/hooks/use-countdown";
import type { TicketLineVM } from "./use-seat-booking";

/** View: hold countdown, chosen seats, email, and the (demo) payment button. */
export function CheckoutPanel({
  lines,
  total,
  expiresAt,
  isBusy,
  onConfirm,
  onChangeSeats,
  onExpired,
}: {
  lines: TicketLineVM[];
  total: string;
  expiresAt: string;
  isBusy: boolean;
  onConfirm: (email: string) => void;
  onChangeSeats: () => void;
  onExpired: () => void;
}) {
  const [email, setEmail] = useState("");
  const countdown = useCountdown(expiresAt, onExpired);
  const isUrgent = countdown.remaining != null && countdown.remaining <= 60;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm(email);
  };

  return (
    <section aria-labelledby="checkout-title" className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="checkout-title" className="text-xl font-semibold text-white">
            Checkout
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            {lines.length} {lines.length === 1 ? "ticket" : "tickets"}
          </p>
        </div>
        <p
          role="timer"
          aria-label={`Seats held for ${countdown.label}`}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium tabular-nums ${
            isUrgent ? "bg-red-500/15 text-red-300" : "bg-marquee-500/15 text-marquee-400"
          }`}
        >
          <Icon name="clock" className="h-4 w-4" />
          {countdown.label}
        </p>
      </div>

      <TicketLines lines={lines} total={total} />

      <p className="mt-4 text-sm text-neutral-400">These seats are held for you until the timer runs out.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-200">Email for your tickets</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="rounded-lg border border-white/15 bg-neutral-950 px-3 py-2.5 text-white placeholder:text-neutral-600 focus:border-marquee-400 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={isBusy}
          className={`rounded-lg bg-marquee-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 disabled:opacity-60 ${focusRing}`}
        >
          {isBusy ? "Booking…" : `Pay ${total} and book`}
        </button>
        <p className="text-center text-xs text-neutral-500">Demo: no payment is taken.</p>
      </form>

      <button
        type="button"
        onClick={onChangeSeats}
        className={`mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-neutral-400 transition hover:text-white ${focusRing}`}
      >
        <Icon name="arrow-left" className="h-4 w-4" />
        Change seats
      </button>
    </section>
  );
}

/** View: one line per ticket (seat, type, price incl. fee) and the total. */
export function TicketLines({ lines, total }: { lines: TicketLineVM[]; total: string }) {
  return (
    <dl className="mt-5 divide-y divide-white/10 border-y border-white/10 text-sm">
      {lines.map((l) => (
        <div key={l.seatId} className="flex items-center justify-between py-2.5">
          <dt className="text-neutral-300">
            <span className="mr-2 inline-block min-w-8 font-medium text-white">{l.seat}</span>
            {l.ticket}
          </dt>
          <dd className="tabular-nums text-neutral-200">{l.amount}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between py-3">
        <dt className="font-semibold text-white">Total (incl. fees)</dt>
        <dd className="text-base font-semibold tabular-nums text-white">{total}</dd>
      </div>
    </dl>
  );
}
