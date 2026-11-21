"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { BookingConfirmation } from "./booking-confirmation";
import type { BookingVM } from "./booking-view-model";
import { CheckoutPanel } from "./checkout-panel";
import { ConfirmTheaterDialog } from "./confirm-theater-dialog";
import { SeatLegend, SeatMap } from "./seat-map";
import { ShowtimePicker } from "./showtime-picker";
import { TicketTypeDialog } from "./ticket-type-dialog";
import { useSeatBooking, type Notice } from "./use-seat-booking";

/** View: the booking flow for one showing (choose seats → checkout → confirmed). */
export function BookingScreen({ vm }: { vm: BookingVM }) {
  const booking = useSeatBooking({
    showingId: vm.showingId,
    initialLayout: vm.layout,
    initialHold: vm.activeHold,
    maxSeats: vm.maxSeats,
    ticketOptions: vm.ticketOptions,
    theaterConfirmed: vm.theaterConfirmed,
  });

  return (
    <main className="pb-32">
      <ShowingHeader vm={vm} />

      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        {booking.phase === "select" && (
          <div className="mb-8">
            <ShowtimePicker picker={vm.showtimes} />
          </div>
        )}
        <NoticeBanner notice={booking.notice} />

        {vm.hasStarted ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-neutral-300">
            This showing has already started, so it can’t be booked online.
          </p>
        ) : booking.phase === "confirmed" && booking.booking ? (
          <BookingConfirmation
            reference={booking.booking.id.slice(0, 8).toUpperCase()}
            email={booking.booking.email}
            lines={booking.paidLines}
            total={booking.paidTotal ?? ""}
            filmTitle={vm.film.title}
            when={vm.when}
            where={vm.where}
          />
        ) : (
          <div className="flex flex-col gap-10">
            <div>
              <SeatMap
                layout={booking.layout}
                selectedIds={booking.selectedIds}
                interactive={booking.phase === "select"}
                onToggle={booking.toggleSeat}
              />
              <SeatLegend />
            </div>

            {booking.phase === "checkout" && booking.hold && (
              <CheckoutPanel
                lines={booking.lines}
                total={booking.total}
                expiresAt={booking.hold.expiresAt}
                isBusy={booking.isBusy}
                onConfirm={booking.confirm}
                onChangeSeats={booking.changeSeats}
                onExpired={booking.onHoldExpired}
              />
            )}
          </div>
        )}
      </div>

      <TicketTypeDialog
        seat={booking.pendingSeat}
        options={vm.ticketOptions}
        note={vm.ticketNote}
        onChoose={booking.chooseTicket}
        onCancel={booking.cancelTicket}
      />

      {!vm.hasStarted && (
        <ConfirmTheaterDialog
          isOpen={booking.needsTheaterConfirmation}
          theater={vm.theater}
          showtimesHref={vm.showtimesHref}
          onConfirm={booking.confirmTheater}
        />
      )}

      {!vm.hasStarted && booking.phase === "select" && (
        <SelectionBar
          labels={booking.selectedLabels}
          total={booking.total}
          preferredTicket={booking.preferredTicketLabel}
          onClearPreference={booking.clearPreference}
          maxSeats={booking.maxSeats}
          isBusy={booking.isBusy}
          onContinue={booking.holdSeats}
        />
      )}
    </main>
  );
}

function ShowingHeader({ vm }: { vm: BookingVM }) {
  return (
    <section className="relative isolate mb-8 overflow-hidden border-b border-white/10">
      {vm.film.backdropUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- decorative backdrop
        <img src={vm.film.backdropUrl} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
      )}
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-neutral-950 via-neutral-950/85 to-neutral-950/40" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <Link href={vm.showtimesHref} className={`mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white ${focusRing}`}>
          <Icon name="arrow-left" className="h-4 w-4" />
          All movies
        </Link>
        <h1 className="font-display text-5xl tracking-wide text-white sm:text-6xl">{vm.film.title}</h1>
        <ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-300">
          {vm.details.map((d) => (
            <li key={d.label} className="flex items-center gap-1.5">
              <Icon name={d.icon} className="h-4 w-4 text-marquee-400" />
              <span className="sr-only">{d.label}: </span>
              {d.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return <div role="status" aria-live="polite" className="sr-only" />;
  const tone = notice.tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-blue-400/30 bg-blue-500/10 text-blue-100";
  return (
    <div role={notice.tone === "error" ? "alert" : "status"} className={`mb-6 rounded-lg border px-4 py-3 text-sm ${tone}`}>
      {notice.text}
    </div>
  );
}

function SelectionBar({
  labels,
  total,
  preferredTicket,
  onClearPreference,
  maxSeats,
  isBusy,
  onContinue,
}: {
  labels: string[];
  total: string;
  preferredTicket: string | null;
  onClearPreference: () => void;
  maxSeats: number;
  isBusy: boolean;
  onContinue: () => void;
}) {
  const hasSeats = labels.length > 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div className="min-w-0 text-sm text-neutral-300">
          <p className="truncate">
            {hasSeats ? (
              <>
                <span className="font-medium text-white">
                  {labels.length} {labels.length === 1 ? "seat" : "seats"}
                </span>
                <span className="ml-2 text-neutral-400">{labels.join(", ")}</span>
                <span className="ml-3 font-semibold text-white">{total}</span>
              </>
            ) : (
              `Choose up to ${maxSeats} seats`
            )}
          </p>
          {preferredTicket && (
            <p className="mt-0.5 text-xs text-neutral-400">
              New seats: <span className="text-marquee-400">{preferredTicket}</span>
              <span aria-hidden> · </span>
              <button type="button" onClick={onClearPreference} className={`underline underline-offset-2 hover:text-white ${focusRing}`}>
                Change
              </button>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasSeats || isBusy}
          className={`shrink-0 rounded-lg bg-marquee-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
        >
          {isBusy ? "Holding seats…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
