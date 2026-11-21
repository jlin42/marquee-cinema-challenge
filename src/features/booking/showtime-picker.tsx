import Link from "next/link";
import { DateStrip } from "@/components/date-strip/date-strip";
import { focusRing } from "@/components/ui/icon-button";
import type { ShowtimePickerVM } from "./booking-view-model";

/** View: date strip plus the chosen day's showtimes for this film at this theater. */
export function ShowtimePicker({ picker }: { picker: ShowtimePickerVM }) {
  if (picker.dates.length === 0) return null;
  return (
    <section aria-label="Date and time" className="rounded-2xl bg-white/[0.03] pb-4">
      <DateStrip dates={picker.dates} />
      <ul className="mt-2 flex flex-wrap gap-3 px-4 sm:px-14">
        {picker.times.map((t) => (
          <li key={t.id}>
            {t.href ? (
              <Link
                href={t.href}
                aria-label={t.ariaLabel}
                aria-current={t.isCurrent ? "page" : undefined}
                className={`inline-flex min-w-28 justify-center rounded-lg border px-5 py-2.5 text-sm font-medium transition ${focusRing} ${
                  t.isCurrent
                    ? "border-marquee-400 bg-marquee-500/15 text-white"
                    : "border-white/15 text-neutral-300 hover:border-white/40 hover:text-white"
                }`}
              >
                {t.time}
              </Link>
            ) : (
              <span
                aria-label={t.ariaLabel}
                className="inline-flex min-w-28 justify-center rounded-lg border border-white/5 px-5 py-2.5 text-sm text-neutral-600 line-through"
              >
                {t.time}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
