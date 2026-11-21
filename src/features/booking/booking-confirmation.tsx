import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { TicketLines } from "./checkout-panel";
import type { TicketLineVM } from "./use-seat-booking";

/** View: booking confirmed. */
export function BookingConfirmation({
  reference,
  name,
  email,
  lines,
  total,
  filmTitle,
  when,
  where,
}: {
  reference: string;
  name: string | null;
  email: string;
  lines: TicketLineVM[];
  total: string;
  filmTitle: string;
  when: string;
  where: string;
}) {
  return (
    <section aria-labelledby="confirmed-title" className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-marquee-500 text-neutral-950">
        <Icon name="check" className="h-7 w-7" />
      </div>
      <h2 id="confirmed-title" className="mt-5 font-display text-5xl tracking-wide text-white">
        You’re booked
      </h2>
      <p className="mt-2 text-sm text-neutral-400">
        {name ? `Thanks, ${name}. ` : ""}Confirmation sent to <span className="text-neutral-200">{email}</span>
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-left text-sm">
        <Detail term="Film" value={filmTitle} wide />
        <Detail term="When" value={when} wide />
        <Detail term="Where" value={where} wide />
        <Detail term="Booking reference" value={reference} mono wide />
      </dl>

      <div className="text-left">
        <TicketLines lines={lines} total={total} />
      </div>

      <Link
        href="/movies"
        className={`mt-8 inline-flex items-center rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 ${focusRing}`}
      >
        Back to movies
      </Link>
    </section>
  );
}

function Detail({ term, value, wide, mono }: { term: string; value: string; wide?: boolean; mono?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wider text-neutral-500">{term}</dt>
      <dd className={`mt-0.5 text-neutral-100 ${mono ? "font-mono tracking-wider" : ""}`}>{value}</dd>
    </div>
  );
}
