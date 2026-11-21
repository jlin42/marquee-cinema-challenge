import Link from "next/link";
import { DateStrip } from "@/components/date-strip/date-strip";
import { focusRing } from "@/components/ui/icon-button";
import { LocationSelect } from "./location-select";
import type { ModifyingVM, StaffMoviesVM } from "./staff-movies-view-model";

/** View: staff Movies tab: theater, date strip, and every film's showtimes. */
export function StaffMoviesScreen({ vm }: { vm: StaffMoviesVM }) {
  return (
    <div className="flex flex-col gap-6">
      {vm.modifying && <ModifyBanner modifying={vm.modifying} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white">Movies</h1>
        <LocationSelect value={vm.location} options={vm.locations} modify={vm.modifying?.bookingId} />
      </div>

      {vm.dates.length > 0 && <DateStrip dates={vm.dates} />}
      <p className="text-sm text-neutral-400">{vm.dateLabel}</p>

      {vm.films.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-neutral-400">
          No showtimes at this theater that day.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {vm.films.map((f) => (
            <li key={f.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-lg font-semibold text-white">{f.title}</p>
              <p className="text-sm text-neutral-400">{f.meta}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {f.showtimes.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      className={`flex min-w-32 flex-col rounded-lg border px-4 py-2 text-sm transition ${focusRing} ${
                        s.isFull ? "border-white/5 text-neutral-500" : "border-white/15 text-white hover:border-marquee-400"
                      }`}
                    >
                      <span className="font-medium">{s.time}</span>
                      <span className="text-xs text-neutral-500">{s.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ModifyBanner({ modifying }: { modifying: ModifyingVM }) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-marquee-400/30 bg-marquee-500/10 px-4 py-3 text-sm">
      <p className="text-neutral-200">
        <span className="font-semibold text-marquee-400">Modifying booking {modifying.reference}</span> for {modifying.customer} ·{" "}
        {modifying.seatCount} {modifying.seatCount === 1 ? "seat" : "seats"} ({modifying.seats}) · now at {modifying.current}. Pick a
        showtime, then choose {modifying.seatCount} {modifying.seatCount === 1 ? "seat" : "seats"}.
      </p>
      <Link href="/staff/movies" className={`text-neutral-400 underline underline-offset-2 hover:text-white ${focusRing}`}>
        Stop modifying
      </Link>
    </div>
  );
}
