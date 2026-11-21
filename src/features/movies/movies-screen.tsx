import Link from "next/link";
import { DateStrip } from "@/components/date-strip/date-strip";
import { FilmCard } from "./film-card";
import type { MoviesVM } from "./movies-view-model";

/** View: the /movies screen, rendered entirely from its view model. */
export function MoviesScreen({ vm }: { vm: MoviesVM }) {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:px-12">
      <div className="mb-6">
        <h1 className="font-display text-6xl tracking-wide text-white">Movies</h1>
        {vm.subtitle && (
          <p className="mt-1 text-neutral-400">
            Showing at <span className="text-neutral-200">{vm.subtitle.name}</span> · {vm.subtitle.city}
          </p>
        )}
      </div>

      {vm.dates.length > 0 && <DateStrip dates={vm.dates} />}

      <p className="mb-6 mt-6 text-sm text-neutral-400">{vm.selectedDateLabel}</p>

      {vm.empty ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
          <p className="text-lg text-neutral-200">{vm.empty.message}</p>
          {vm.empty.next && (
            <Link href={vm.empty.next.href} className="mt-4 inline-block text-marquee-400 hover:text-marquee-500">
              {vm.empty.next.label}
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {vm.films.map((film) => (
            <FilmCard key={film.id} film={film} />
          ))}
        </div>
      )}
    </main>
  );
}
