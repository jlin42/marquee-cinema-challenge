"use client";

import { IconButton } from "@/components/ui/icon-button";
import { FilmSlide } from "./film-slide";
import type { FilmSlideVM } from "./home-view-model";
import { useCarousel } from "./use-carousel";

const INTERVAL_MS = 7000;

/** View: full-screen hero carousel. All behavior lives in `useCarousel`. */
export function FilmCarousel({ slides }: { slides: FilmSlideVM[] }) {
  const carousel = useCarousel(slides.length, INTERVAL_MS);

  if (slides.length === 0) {
    return (
      <section className="flex h-[100svh] items-center justify-center px-6 text-center">
        <p className="text-neutral-400">No films are showing right now. Check back soon.</p>
      </section>
    );
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Now showing"
      className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-black"
      {...carousel.rootHandlers}
    >
      {slides.map((slide, i) => (
        <FilmSlide key={slide.id} slide={slide} position={i + 1} total={slides.length} isActive={i === carousel.index} />
      ))}

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-6 px-6 pb-8 sm:px-12 lg:px-20">
        <SlideTabs slides={slides} index={carousel.index} isPaused={carousel.isPaused} onSelect={carousel.goTo} />
        <div className="flex shrink-0 items-center gap-2">
          <IconButton
            icon={carousel.isUserPaused ? "play" : "pause"}
            label={carousel.isUserPaused ? "Play carousel" : "Pause carousel"}
            onClick={carousel.togglePause}
          />
          <IconButton icon="chevron-left" label="Previous film" onClick={carousel.prev} />
          <IconButton icon="chevron-right" label="Next film" onClick={carousel.next} />
        </div>
      </div>
    </section>
  );
}

/** View: film names with a progress bar under the current one. */
function SlideTabs({
  slides,
  index,
  isPaused,
  onSelect,
}: {
  slides: FilmSlideVM[];
  index: number;
  isPaused: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex flex-1 gap-3" role="tablist" aria-label="Choose a film">
      {slides.map((slide, i) => {
        const isActive = i === index;
        return (
          <button
            key={slide.id}
            role="tab"
            aria-selected={isActive}
            aria-label={slide.title}
            onClick={() => onSelect(i)}
            className="group flex max-w-48 flex-1 flex-col gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marquee-400"
          >
            <span className="relative h-0.5 w-full overflow-hidden rounded-full bg-white/20">
              {isActive && (
                <span
                  key={`${index}-${isPaused}`}
                  className="absolute inset-0 origin-left bg-marquee-400"
                  style={isPaused ? undefined : { animation: `carousel-progress ${INTERVAL_MS}ms linear forwards` }}
                />
              )}
            </span>
            <span className={`hidden truncate text-xs sm:block ${isActive ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"}`}>
              {slide.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
