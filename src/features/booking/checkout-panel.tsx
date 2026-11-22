"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { useCountdown } from "@/hooks/use-countdown";
import { DiscountField } from "./discount-field";
import { PaymentFields } from "./payment-fields";
import { useMockCard } from "./use-mock-card";
import type { TicketLineVM } from "./use-seat-booking";

export type CheckoutDiscountVM = {
  applied: { code: string; label: string; amount: string } | null;
  error: string | null;
  isChecking: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
};

/** View: hold countdown, tickets, booker details, discount code, (demo) payment, book. */
export function CheckoutPanel({
  lines,
  total,
  amountDue,
  isFree,
  discount,
  expiresAt,
  isBusy,
  onConfirm,
  onChangeSeats,
  onExpired,
}: {
  lines: TicketLineVM[];
  total: string;
  amountDue: string;
  isFree: boolean;
  discount: CheckoutDiscountVM;
  expiresAt: string;
  isBusy: boolean;
  onConfirm: (name: string, email: string, paymentReady: boolean) => void;
  onChangeSeats: () => void;
  onExpired: () => void;
}) {
  const card = useMockCard();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const countdown = useCountdown(expiresAt, onExpired);
  const isUrgent = countdown.remaining != null && countdown.remaining <= 60;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Nothing to pay (e.g. a 100% code): skip the card entirely.
    onConfirm(name, email, isFree || card.validate());
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

      <TicketLines
        lines={lines}
        total={discount.applied ? amountDue : total}
        subtotal={discount.applied ? total : undefined}
        discount={discount.applied ? { label: `Discount (${discount.applied.code})`, amount: discount.applied.amount } : undefined}
      />

      <p className="mt-4 text-sm text-neutral-400">These seats are held for you until the timer runs out.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-200">Full name</span>
          <input
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="rounded-lg border border-white/15 bg-neutral-950 px-3 py-2.5 text-white placeholder:text-neutral-600 focus:border-marquee-400 focus:outline-none"
          />
        </label>
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

        <DiscountField
          applied={discount.applied}
          error={discount.error}
          isChecking={discount.isChecking}
          onApply={discount.onApply}
          onRemove={discount.onRemove}
        />

        <div className="mt-2 border-t border-white/10 pt-5">
          {isFree ? (
            <p className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-3 text-sm text-neutral-300">
              <Icon name="check" className="h-4 w-4 shrink-0 text-marquee-400" />
              No payment needed: your discount covers the whole order.
            </p>
          ) : (
            <PaymentFields card={card} />
          )}
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className={`mt-1 rounded-lg bg-marquee-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 disabled:opacity-60 ${focusRing}`}
        >
          {isBusy ? "Booking…" : isFree ? `Book for ${amountDue}` : `Pay ${amountDue} and book`}
        </button>
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

/** View: one line per ticket (seat, type, price incl. fee), any discount, and the total. */
export function TicketLines({
  lines,
  total,
  subtotal,
  discount,
}: {
  lines: TicketLineVM[];
  total: string;
  subtotal?: string;
  discount?: { label: string; amount: string };
}) {
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
      {subtotal && discount && (
        <div className="py-2.5">
          <div className="flex items-center justify-between text-neutral-400">
            <dt>Subtotal (incl. fees)</dt>
            <dd className="tabular-nums">{subtotal}</dd>
          </div>
          <div className="mt-1 flex items-center justify-between text-marquee-400">
            <dt>{discount.label}</dt>
            <dd className="tabular-nums">{discount.amount}</dd>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between py-3">
        <dt className="font-semibold text-white">{discount ? "Total" : "Total (incl. fees)"}</dt>
        <dd className="text-base font-semibold tabular-nums text-white">{total}</dd>
      </div>
    </dl>
  );
}
