"use client";

import Link from "next/link";
import { focusRing, IconButton } from "@/components/ui/icon-button";
import type { DateChipVM } from "./movies-view-model";
import { useDateStrip } from "./use-date-strip";

/**
 * View: paged date picker. Each page holds whole dates from a single month,
 * opened by that month's tab; months are split into evenly sized pages, and
 * a page's dates always spread across the full width.
 */
export function DateStrip({ dates }: { dates: DateChipVM[] }) {
  const strip = useDateStrip(dates);

  return (
    <div className="flex items-center gap-1 rounded-2xl bg-white/[0.03] px-1 py-2">
      <IconButton
        icon="chevron-left"
        label="Earlier dates"
        variant="ghost"
        iconClassName="h-6 w-6"
        onClick={strip.prev}
        disabled={!strip.hasPrev}
      />

      <div ref={strip.viewportRef} className="min-w-0 flex-1 overflow-hidden">
        {strip.page && (
          <div
            key={strip.pageKey}
            role="list"
            aria-label="Choose a date"
            className="grid items-center gap-1 motion-safe:animate-[date-page-in_220ms_ease-out]"
            style={{ gridTemplateColumns: `2rem repeat(${strip.page.items.length}, minmax(0, 1fr))` }}
          >
            <MonthTab label={strip.page.month} />
            {strip.page.items.map((d) => (
              <div role="listitem" key={d.date}>
                <Link
                  href={d.href}
                  scroll={false}
                  aria-current={d.isSelected ? "date" : undefined}
                  aria-label={d.ariaLabel}
                  className={`flex w-full flex-col items-center rounded-xl py-2 transition ${focusRing} ${
                    d.isSelected ? "bg-marquee-500 text-neutral-950" : "text-white hover:bg-white/[0.08]"
                  }`}
                >
                  <span className="text-xl font-medium leading-tight">{d.day}</span>
                  <span className={`text-xs ${d.isSelected ? "font-medium text-neutral-800" : "text-neutral-400"}`}>{d.weekday}</span>
                </Link>
              </div>
            ))}
          </div>
        )}
        <p aria-live="polite" className="sr-only">
          {strip.rangeLabel}
        </p>
      </div>

      <IconButton
        icon="chevron-right"
        label="Later dates"
        variant="ghost"
        iconClassName="h-6 w-6"
        onClick={strip.next}
        disabled={!strip.hasNext}
      />
    </div>
  );
}

function MonthTab({ label }: { label: string }) {
  return (
    <div role="listitem" aria-label={label} className="flex w-8 flex-col items-center rounded-lg bg-white/[0.08] py-1.5">
      {label.split("").map((ch, i) => (
        <span key={i} aria-hidden className="text-[11px] font-semibold leading-tight text-neutral-300">
          {ch}
        </span>
      ))}
    </div>
  );
}
