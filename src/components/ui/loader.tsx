"use client";

import { useEffect, useState } from "react";

const MOTIFS = ["ticket", "seat", "popcorn", "reel"] as const;
type Motif = (typeof MOTIFS)[number];

/**
 * Loading indicator: a short spinning ring with a small animated cinema motif in the
 * middle (ticket, seat, popcorn or film reel, picked at random). The pick happens after
 * mount so server and client markup match. It fades in after ~120 ms, so quick steps
 * don't flash a spinner.
 */
export function Loader({ label = "Loading", caption, size = "md" }: { label?: string; caption?: string; size?: "md" | "lg" }) {
  const [motif, setMotif] = useState<Motif | null>(null);
  useEffect(() => {
    setMotif(MOTIFS[Math.floor(Math.random() * MOTIFS.length)]!);
  }, []);

  const box = size === "lg" ? "h-20 w-20" : "h-16 w-16";
  return (
    <div role="status" aria-live="polite" className="loader-appear flex flex-col items-center gap-4">
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

/** Full-area loader for route transitions (used by loading.tsx files). */
export function PageLoader({ caption }: { caption?: string }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <Loader size="lg" caption={caption} />
    </div>
  );
}

/** Blocking overlay while a step is in progress (e.g. holding seats, booking). */
export function StepLoaderOverlay({ isOpen, caption }: { isOpen: boolean; caption: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm" aria-busy="true">
      <Loader size="lg" caption={caption} />
    </div>
  );
}
