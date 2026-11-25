"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";

const SWIPE_THRESHOLD_PX = 50;

/**
 * View-model hook for an auto-advancing carousel.
 * Only the pause button pauses it (hovering or focusing elsewhere on the page never
 * does). Pausing freezes the countdown where it is and resuming continues from there.
 * With reduced motion it still advances (only the pause button stops it, as the client
 * asked); the slides just fade instead of moving. Fewer than 2 slides: no auto-advance.
 */
export function useCarousel(count: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  /** Auto-advance is on at all (it can still be paused by the user). */
  const autoAdvances = count >= 2;
  const isPaused = isUserPaused || !autoAdvances;

  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const togglePause = useCallback(() => setIsUserPaused((p) => !p), []);

  // Time left on the current slide, so a pause/resume continues instead of restarting.
  const remaining = useRef(intervalMs);
  useEffect(() => {
    remaining.current = intervalMs; // a new slide gets the full interval
  }, [index, intervalMs]);

  useEffect(() => {
    if (isPaused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(next, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [isPaused, next]);

  /** Spread onto the carousel's root element. */
  const rootHandlers = {
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    },
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      touchStartX.current = e.touches[0]?.clientX ?? null;
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => {
      const start = touchStartX.current;
      const end = e.changedTouches[0]?.clientX;
      touchStartX.current = null;
      if (start == null || end == null || Math.abs(end - start) < SWIPE_THRESHOLD_PX) return;
      if (end < start) next();
      else prev();
    },
  };

  return { index, isPaused, isUserPaused, autoAdvances, goTo, next, prev, togglePause, rootHandlers };
}
