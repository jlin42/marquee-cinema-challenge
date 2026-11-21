"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DateChipVM } from "./date-chips";
import { paginateByMonth } from "./paginate-dates";

// Layout constants shared with date-strip.tsx (Tailwind: month tab w-8, gap-1).
const TAB_WIDTH_PX = 32;
const CHIP_MIN_WIDTH_PX = 56;
const GAP_PX = 4;
const DEFAULT_CAPACITY = 7; // before the strip has been measured (server render)

/** How many whole date chips fit after the month tab: TAB + n × (CHIP + GAP) ≤ width. */
const capacityFor = (width: number) => Math.max(1, Math.floor((width - TAB_WIDTH_PX) / (CHIP_MIN_WIDTH_PX + GAP_PX)));

/**
 * View-model hook for the date strip: pages of whole dates, one month per page,
 * evenly divided. The current page is tracked by an "anchor" date, so resizing
 * (which changes the page size) keeps you on the same dates.
 */
export function useDateStrip(dates: DateChipVM[]) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const selected = dates.find((d) => d.isSelected)?.date ?? dates[0]?.date ?? "";
  const [anchor, setAnchor] = useState(selected);

  // Measure the available width, and re-measure on resize.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const capacity = width == null ? DEFAULT_CAPACITY : capacityFor(width);
  const pages = useMemo(() => paginateByMonth(dates, capacity), [dates, capacity]);
  const pageIndex = Math.max(0, pages.findIndex((p) => p.items.some((d) => d.date === anchor)));

  // When the selection moves to a date on another page (e.g. the "next day" link), follow it.
  useEffect(() => {
    setAnchor((current) => {
      const page = pages.find((p) => p.items.some((d) => d.date === current));
      return page?.items.some((d) => d.date === selected) ? current : selected;
    });
    // Only when the selection itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const goTo = (index: number) => {
    const page = pages[index];
    if (page) setAnchor(page.items[0]!.date);
  };

  const page = pages[pageIndex];
  return {
    viewportRef,
    page,
    pageKey: page ? `${page.month}-${page.items[0]?.date}` : "empty",
    hasPrev: pageIndex > 0,
    hasNext: pageIndex < pages.length - 1,
    prev: () => goTo(pageIndex - 1),
    next: () => goTo(pageIndex + 1),
    /** False until the strip has been measured; the view hides it to avoid a resize flash. */
    isMeasured: width != null,
    rangeLabel: page ? `${page.items[0]!.ariaLabel} to ${page.items.at(-1)!.ariaLabel}` : "",
  };
}
