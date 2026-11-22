import Link from "next/link";
import { focusRing } from "@/components/ui/icon-button";
import type { FilmSlideVM } from "./home-view-model";

/** View: one full-screen film slide (backdrop, details, showtimes). */
export function FilmSlide({ slide, position, total, isActive }: { slide: FilmSlideVM; position: number; total: number; isActive: boolean }) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} of ${total}: ${slide.title}`}
      aria-hidden={!isActive}
      inert={!isActive}
      className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out motion-reduce:duration-300 ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      {slide.backdropUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local SVG art; next/image adds nothing here
        <img
          src={slide.backdropUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[8000ms] ease-out motion-reduce:transition-none ${
            isActive ? "scale-100" : "scale-110"
          }`}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black via-black/60 to-transparent" />

      <div className="relative flex h-full flex-col justify-end px-6 pb-40 sm:px-12 sm:pb-32 lg:px-20">
        {/*
          Text leaves quickly as the backdrop starts to change, and the new film's text
          comes in half a second later, once the new backdrop is mostly in.
        */}
        <div
          className={`max-w-2xl transition-[opacity,transform] motion-reduce:translate-y-0 ${
            isActive
              ? "translate-y-0 opacity-100 delay-500 duration-700 ease-out"
              : "translate-y-3 opacity-0 delay-0 duration-300 ease-in"
          }`}
        >
          <MetaLine items={slide.meta} />
          <h2 className="font-display text-6xl leading-[0.9] tracking-wide text-white sm:text-8xl lg:text-9xl">{slide.title}</h2>
          {slide.tagline && <p className="mt-4 text-lg font-medium text-marquee-400 sm:text-xl">{slide.tagline}</p>}
          {slide.synopsis && <p className="mt-3 line-clamp-3 max-w-xl text-base leading-relaxed text-neutral-300 sm:line-clamp-none">{slide.synopsis}</p>}

          {slide.showtimes.length > 0 ? (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-400">Next showtimes</p>
              {/* Stacked on phones (full-width rows, first three), a wrapping row from sm up. */}
              <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap [&>li:nth-child(n+4)]:hidden sm:[&>li:nth-child(n+4)]:block">
                {slide.showtimes.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      className={`flex items-baseline justify-between gap-3 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-left backdrop-blur-sm transition hover:border-marquee-400 hover:bg-white/10 sm:flex-col sm:items-start sm:gap-0 ${focusRing}`}
                    >
                      <span className="text-sm font-medium text-white">{s.title}</span>
                      <span className="text-xs text-neutral-400">{s.subtitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-neutral-400">No upcoming showtimes.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaLine({ items }: { items: string[] }) {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-300">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-neutral-500" />}
          {item}
        </span>
      ))}
    </p>
  );
}
