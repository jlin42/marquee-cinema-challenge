import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { PrintButton } from "./print-button";
import type { TicketVM } from "./ticket-view-model";

/** View: the booking confirmation, laid out as a ticket with its QR code. */
export function TicketScreen({ vm }: { vm: TicketVM }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-8 sm:pt-12">
      {vm.isCancelled ? (
        <p role="status" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
          This booking was cancelled. The ticket below is no longer valid.
        </p>
      ) : (
        <header className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-marquee-500 text-neutral-950">
            <Icon name="check" className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-5xl tracking-wide text-white">You’re booked</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {vm.greeting} Tickets sent to <span className="text-neutral-200">{vm.email}</span>
          </p>
        </header>
      )}

      <article
        aria-label={`Ticket for ${vm.film.title}`}
        className={`overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl ring-1 ring-white/10 ${vm.isCancelled ? "opacity-50 grayscale" : ""}`}
      >
        {/* Film banner */}
        <div className="relative h-36">
          {vm.film.backdropUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- local SVG art
            <img src={vm.film.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-neutral-900 via-neutral-900/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-3">
            <p className="text-xs text-neutral-300">{vm.film.meta}</p>
            <h2 className="font-display text-4xl leading-none tracking-wide text-white">{vm.film.title}</h2>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 text-sm">
          {vm.details.map((d) => (
            <div key={d.term} className={d.term === "Date" || d.term.startsWith("Seat") ? "col-span-2" : ""}>
              <dt className="text-xs uppercase tracking-widest text-neutral-500">{d.term}</dt>
              <dd className="mt-0.5 font-medium text-white">{d.value}</dd>
            </div>
          ))}
        </dl>

        {/* Perforation: dashed line with notches cut into each edge. */}
        <div aria-hidden className="relative flex items-center">
          <span className="absolute -left-3 h-6 w-6 rounded-full bg-neutral-950" />
          <span className="mx-6 w-full border-t-2 border-dashed border-white/15" />
          <span className="absolute -right-3 h-6 w-6 rounded-full bg-neutral-950" />
        </div>

        <div className="flex flex-col items-center px-6 py-6">
          <div className="rounded-xl bg-white p-3">
            <svg
              role="img"
              aria-label={`QR code for confirmation ${vm.confirmationCode}`}
              viewBox={`-1 -1 ${vm.qr.size + 2} ${vm.qr.size + 2}`}
              className="h-44 w-44"
              shapeRendering="crispEdges"
            >
              <path d={vm.qr.path} fill="#0a0a0a" />
            </svg>
          </div>
          <p className="mt-4 text-xs uppercase tracking-widest text-neutral-500">Confirmation number</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.15em] text-white">{vm.confirmationDisplay}</p>
          <p className="mt-2 text-center text-xs text-neutral-500">Show this code at the door. (Demo QR: not scannable.)</p>
        </div>

        <div className="border-t border-white/10 px-6 py-5">
          <h3 className="sr-only">Receipt</h3>
          <dl className="text-sm">
            {vm.lines.map((l) => (
              <div key={l.key} className="flex items-baseline justify-between py-1">
                <dt className="text-neutral-300">
                  <span className="mr-2 inline-block min-w-8 font-medium text-white">{l.label}</span>
                  {l.detail}
                </dt>
                <dd className="tabular-nums text-neutral-200">{l.amount}</dd>
              </div>
            ))}
            {vm.subtotal && vm.discount && (
              <>
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-neutral-400">
                  <dt>Subtotal (incl. fees)</dt>
                  <dd className="tabular-nums">{vm.subtotal}</dd>
                </div>
                <div className="flex justify-between py-1 text-marquee-400">
                  <dt>{vm.discount.label}</dt>
                  <dd className="tabular-nums">{vm.discount.amount}</dd>
                </div>
              </>
            )}
            <div className="mt-2 flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
              <dt>Total</dt>
              <dd className="tabular-nums">{vm.total}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-neutral-500">{vm.paidNote}</p>
        </div>
      </article>

      <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
        <PrintButton />
        <Link href="/movies" className={`rounded-lg bg-marquee-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 ${focusRing}`}>
          Back to movies
        </Link>
      </div>
    </main>
  );
}
