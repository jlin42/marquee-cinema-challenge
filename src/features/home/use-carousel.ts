"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type TouchEvent } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

const SWIPE_THRESHOLD_PX = 50;

/**
 * View-model hook for an auto-advancing carousel.
 * Pauses on hover, focus, the pause button, reduced-motion, or with fewer than 2 slides.
 */
export function useCarousel(count: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const touchStartX = useRef<number | null>(null);

  const isPaused = isHovered || isUserPaused || prefersReducedMotion || count < 2;

  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const togglePause = useCallback(() => setIsUserPaused((p) => !p), []);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setTimeout(next, intervalMs);
    return () => window.clearTimeout(timer);
  }, [isPaused, next, intervalMs]);

  /** Spread onto the carousel's root element. */
  const rootHandlers = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    onFocus: () => setIsHovered(true),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsHovered(false);
    },
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

  return { index, isPaused, isUserPaused, goTo, next, prev, togglePause, rootHandlers };
}
