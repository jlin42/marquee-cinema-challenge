"use client";

import { useRouter } from "next/navigation";
import type { OptionVM } from "./dashboard-view-model";

/** View: theater picker for the staff Movies tab (keeps an in-progress modification). */
export function LocationSelect({ value, options, modify }: { value: string; options: OptionVM[]; modify?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-400">Theater</span>
      <select
        value={value}
        onChange={(e) => router.push(`/staff/movies?location=${e.target.value}${modify ? `&modify=${modify}` : ""}`)}
        className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-white focus:border-marquee-400 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
