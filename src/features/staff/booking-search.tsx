import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import type { BookingSearchVM } from "./dashboard-view-model";

/** View: find a booking anywhere (plain GET form, so results have a shareable URL). */
export function BookingSearch({ search }: { search: BookingSearchVM }) {
  return (
    <section aria-labelledby="find-title" className="flex flex-col gap-3">
      <form action="/staff/dashboard" method="get" role="search" className="flex w-full max-w-xl gap-2">
        <label htmlFor="find" id="find-title" className="sr-only">
          Find a booking
        </label>
        <div className="relative min-w-0 flex-1">
          <Icon name="tag" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            id="find"
            name="find"
            type="search"
            defaultValue={search.query}
            placeholder={`Find a booking (${search.hint.toLowerCase()})`}
            title={`Find a booking by ${search.hint.toLowerCase()}`}
            autoComplete="off"
            className="w-full rounded-lg border border-white/15 bg-neutral-900 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:border-marquee-400 focus:outline-none"
          />
        </div>
        <button type="submit" className={`rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20 ${focusRing}`}>
          Search
        </button>
        {search.query && (
          <Link href="/staff/dashboard" className={`flex items-center rounded-lg px-3 text-sm text-neutral-400 hover:text-white ${focusRing}`}>
            Clear
          </Link>
        )}
      </form>

      {search.query.length >= 2 && (
        <div className="max-w-3xl rounded-xl border border-white/10">
          <p className="border-b border-white/10 px-4 py-2.5 text-xs text-neutral-400">
            {search.results.length === 0
              ? `No bookings match “${search.query}”.`
              : `${search.results.length}${search.results.length === 25 ? "+" : ""} booking${search.results.length === 1 ? "" : "s"} match “${search.query}” (newest first)`}
          </p>
          {search.results.length > 0 && (
            <ul className="divide-y divide-white/5">
              {search.results.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3 text-sm hover:bg-white/[0.04] ${focusRing}`}>
                    <span className="min-w-0">
                      <span className="font-medium text-white">{r.customerName}</span>
                      <span className="ml-2 text-neutral-400">{r.email}</span>
                      <span className="block text-neutral-300">
                        {r.film} · {r.when} · {r.where} · {r.seats}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {r.isCancelled && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300">Cancelled</span>}
                      <span className="font-mono text-xs text-neutral-400">{r.reference}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
