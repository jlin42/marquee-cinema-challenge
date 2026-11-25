"use client";

import type { DashboardVM, OptionVM } from "./dashboard-view-model";
import { useDashboardFilters } from "./use-dashboard-filters";

/**
 * View: cinema / screen / date / showing pickers. Each change updates the URL, so a
 * dashboard view can be bookmarked or shared with a colleague. Changing a broader
 * filter resets the narrower ones.
 */
export function DashboardFilters({ filters }: { filters: DashboardVM["filters"] }) {
  const { go, isPending } = useDashboardFilters();

  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${isPending ? "opacity-60" : ""}`} aria-busy={isPending}>
      <Select
        label="Cinema"
        value={filters.location}
        options={filters.locations}
        onChange={(location) => go({ location, date: filters.date })}
      />
      <Select
        label="Screen"
        value={filters.screen}
        options={filters.screens}
        onChange={(screen) => go({ location: filters.location, screen, date: filters.date })}
      />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-neutral-300">Date</span>
        <input
          type="date"
          value={filters.date}
          onChange={(e) => e.target.value && go({ location: filters.location, screen: filters.screen, date: e.target.value })}
          className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2.5 text-white [color-scheme:dark] focus:border-marquee-400 focus:outline-none"
        />
      </label>
      <Select
        label="Showing"
        value={filters.showing}
        options={filters.showings}
        emptyLabel="No showings"
        onChange={(showing) => go({ location: filters.location, screen: filters.screen, date: filters.date, showing })}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  disabled,
  emptyLabel = "None",
}: {
  label: string;
  value: string;
  options: OptionVM[];
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-300">{label}</span>
      <select
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2.5 text-white focus:border-marquee-400 focus:outline-none disabled:opacity-70"
      >
        {options.length === 0 && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
