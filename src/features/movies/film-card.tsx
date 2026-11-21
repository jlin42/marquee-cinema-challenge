import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import type { FilmCardVM, ShowtimeVM } from "./movies-view-model";

/**
 * View: wide film card. Poster left; title, details and showtimes right.
 * The background is the film's own artwork, blurred, so each card takes on its colors.
 */
export function FilmCard({ film }: { film: FilmCardVM }) {
  return (
    <article className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
      {film.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- decorative tint only
        <img src={film.posterUrl} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-50 blur-3xl" />
      )}
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-neutral-950/60 via-neutral-950/80 to-neutral-950/70" />

      <div className="flex">
        <Poster title={film.title} url={film.posterUrl} />

        <div className="flex min-w-0 flex-1 flex-col px-5 py-5 sm:px-8 sm:py-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">{film.title}</h2>
              <MetaLine items={film.meta} />
            </div>
            {film.ticketsHref && (
              <Link
                href={film.ticketsHref}
                aria-label={`Get tickets for ${film.title}`}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-neutral-200 transition hover:bg-white/20 hover:text-white ${focusRing}`}
              >
                <Icon name="chevron-right" className="h-5 w-5" />
              </Link>
            )}
          </div>

          <hr className="my-5 border-white/10" />

          <h3 className="mb-3 text-sm font-medium text-neutral-200">Showtimes</h3>
          <ul className="flex flex-wrap gap-3">
            {film.showtimes.map((s) => (
              <li key={s.id}>
                <ShowtimeButton showtime={s} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function Poster({ title, url }: { title: string; url: string | null }) {
  return (
    <div className="relative min-h-[168px] w-28 shrink-0 overflow-hidden bg-black sm:min-h-[264px] sm:w-44 lg:min-h-[312px] lg:w-52">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- local SVG art
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-[78%_50%]" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-12">
        <p className="font-display text-xl leading-none tracking-wide text-white sm:text-3xl">{title}</p>
      </div>
    </div>
  );
}

function MetaLine({ items }: { items: string[] }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-400">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden className="h-3 w-px bg-neutral-600" />}
          {item}
        </span>
      ))}
    </p>
  );
}

const DETAIL_TONE: Record<ShowtimeVM["tone"], string> = {
  default: "text-neutral-500",
  low: "text-marquee-400",
  soldOut: "text-neutral-600",
};

function ShowtimeButton({ showtime: s }: { showtime: ShowtimeVM }) {
  const base = "flex w-28 flex-col items-center rounded-lg py-3 text-sm";
  const detail = <span className={`text-[11px] font-normal ${DETAIL_TONE[s.tone]}`}>{s.detail}</span>;

  if (!s.href) {
    return (
      <span aria-label={s.ariaLabel} className={`${base} bg-white/[0.03] text-neutral-600`}>
        <span className="line-through">{s.time}</span>
        {detail}
      </span>
    );
  }
  return (
    <Link href={s.href} aria-label={s.ariaLabel} className={`${base} bg-white/[0.06] font-medium text-white transition hover:bg-white/[0.12] ${focusRing}`}>
      {s.time}
      {detail}
    </Link>
  );
}
