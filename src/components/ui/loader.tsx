"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const MOTIFS = ["ticket", "seat", "popcorn", "reel"] as const;
type Motif = (typeof MOTIFS)[number];
const randomMotif = (): Motif => MOTIFS[Math.floor(Math.random() * MOTIFS.length)]!;

/** Every loading animation stays up at least this long, so it never just flickers. */
export const MIN_LOADER_MS = 1200;

/**
 * Keeps `isOpen` true for at least MIN_LOADER_MS after it first turns on, then follows
 * it. Used by in-page step loaders.
 */
export function useMinimumVisible(isOpen: boolean, minMs = MIN_LOADER_MS) {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  useEffect(() => {
    if (isOpen && openedAt === null) setOpenedAt(Date.now());
    if (!isOpen && openedAt !== null) {
      const remaining = openedAt + minMs - Date.now();
      if (remaining <= 0) {
        setOpenedAt(null);
        return;
      }
      const t = setTimeout(() => setOpenedAt(null), remaining);
      return () => clearTimeout(t);
    }
  }, [isOpen, openedAt, minMs]);
  return isOpen || openedAt !== null;
}

/*
 * Route loaders (loading.tsx) unmount the moment the next page is ready. To still show
 * them for MIN_LOADER_MS, each one registers here, and <RouteLoaderHold/> (in the root
 * layout) keeps an identical full-screen loader up for whatever time is left.
 */
type RouteLoaderState = { until: number; motif: Motif; caption?: string } | null;
let routeLoader: RouteLoaderState = null;
const listeners = new Set<() => void>();
const setRouteLoader = (next: RouteLoaderState) => {
  routeLoader = next;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * Loading indicator: a short spinning ring with a small animated cinema motif in the
 * middle (ticket, seat, popcorn or film reel, picked at random). The pick happens after
 * mount so server and client markup match. It fades in after ~120 ms, so quick steps
 * don't flash a spinner.
 */
export function Loader({
  label = "Loading",
  caption,
  size = "md",
  motif: fixedMotif,
  appear = true,
}: {
  label?: string;
  caption?: string;
  size?: "md" | "lg";
  /** Use this motif instead of a random one (keeps a held loader looking the same). */
  motif?: Motif;
  /** Fade in after a moment (off when continuing a loader that's already showing). */
  appear?: boolean;
}) {
  const [randomPick, setRandomPick] = useState<Motif | null>(null);
  useEffect(() => {
    if (!fixedMotif) setRandomPick(randomMotif());
  }, [fixedMotif]);
  const motif = fixedMotif ?? randomPick;

  const box = size === "lg" ? "h-20 w-20" : "h-16 w-16";
  return (
    <div role="status" aria-live="polite" className={`${appear ? "loader-appear" : ""} flex flex-col items-center gap-4`}>
      <div className={`relative ${box}`}>
        {/* Track and spinning arc */}
        <span className="absolute inset-0 rounded-full border-[3px] border-white/10" />
        <span className="loader-ring absolute inset-0 rounded-full border-[3px] border-transparent border-t-marquee-400 border-r-marquee-400/40" />
        <span className="absolute inset-0 flex items-center justify-center text-marquee-400">
          {motif && <MotifIcon motif={motif} />}
        </span>
      </div>
      {caption && <p className="text-sm text-neutral-300">{caption}</p>}
      <span className="sr-only">{caption ?? label}…</span>
    </div>
  );
}

function MotifIcon({ motif }: { motif: Motif }) {
  const svg = { viewBox: "0 0 24 24", className: "h-7 w-7 overflow-visible", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true };
  switch (motif) {
    case "ticket":
      return (
        <svg {...svg}>
          <g className="loader-ticket">
            {/* Ticket stub: notches on both ends, perforation near the right. */}
            <path d="M3 7H21V10A2 2 0 0 0 21 14V17H3V14A2 2 0 0 0 3 10Z" />
            <path d="M15 7.5v9" strokeDasharray="1.5 2" />
          </g>
        </svg>
      );
    case "seat":
      return (
        <svg {...svg}>
          <g className="loader-seat">
            <path d="M7 12V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" />
            <path d="M5 12h14a1 1 0 0 1 1 1v3H4v-3a1 1 0 0 1 1-1z" fill="currentColor" fillOpacity="0.25" />
            <path d="M6 16v4M18 16v4" />
          </g>
        </svg>
      );
    case "popcorn":
      return (
        <svg {...svg}>
          <circle className="loader-kernel" cx="9" cy="6" r="1.8" fill="currentColor" style={{ animationDelay: "0ms", ["--pop-x" as string]: "-2px" }} />
          <circle className="loader-kernel" cx="12" cy="5" r="1.8" fill="currentColor" style={{ animationDelay: "400ms" }} />
          <circle className="loader-kernel" cx="15" cy="6" r="1.8" fill="currentColor" style={{ animationDelay: "800ms", ["--pop-x" as string]: "2px" }} />
          <path d="M5 9h14l-1.6 11a1 1 0 0 1-1 .9H7.6a1 1 0 0 1-1-.9z" />
          <path d="M10 9.5l.5 11M14 9.5l-.5 11" strokeOpacity="0.5" />
        </svg>
      );
    case "reel":
      return (
        <svg {...svg}>
          <g className="loader-reel">
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="1.3" fill="currentColor" />
            <circle cx="12" cy="7.2" r="1.9" />
            <circle cx="16.6" cy="13.5" r="1.9" />
            <circle cx="7.4" cy="13.5" r="1.9" />
          </g>
        </svg>
      );
  }
}

/** Full-screen loader for route transitions (used by loading.tsx files). */
export function PageLoader({ caption }: { caption?: string }) {
  // Pick the motif once and register, so the hold overlay can continue the same loader.
  const [motif] = useState<Motif>(() => randomMotif());
  useEffect(() => {
    const until = Date.now() + MIN_LOADER_MS;
    setRouteLoader({ until, motif, caption });
  }, [motif, caption]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950 px-6">
      <Loader size="lg" caption={caption} motif={motif} />
    </div>
  );
}

/**
 * Root-layout companion to PageLoader: after the route loader unmounts, keeps the same
 * loader on screen until MIN_LOADER_MS has passed, then fades it out.
 */
export function RouteLoaderHold() {
  const state = useSyncExternalStore(subscribe, () => routeLoader, () => null);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!state) return;
    const remaining = state.until - Date.now();
    if (remaining <= 0) {
      setRouteLoader(null);
      return;
    }
    setFading(false);
    const fade = setTimeout(() => setFading(true), Math.max(0, remaining - 200));
    const done = setTimeout(() => setRouteLoader(null), remaining);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [state]);
  if (!state) return null;
  return (
    <div
      aria-hidden={fading}
      className={`fixed inset-0 z-40 flex items-center justify-center bg-neutral-950 px-6 transition-opacity duration-200 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <Loader size="lg" caption={state.caption} motif={state.motif} appear={false} />
    </div>
  );
}

/** Blocking overlay while a step is in progress (e.g. holding seats, booking); shown at least MIN_LOADER_MS. */
export function StepLoaderOverlay({ isOpen, caption }: { isOpen: boolean; caption: string }) {
  const visible = useMinimumVisible(isOpen);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm" aria-busy="true">
      <Loader size="lg" caption={caption} />
    </div>
  );
}
