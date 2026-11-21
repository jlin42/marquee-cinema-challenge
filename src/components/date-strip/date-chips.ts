import { dateParts } from "@/lib/time";

/** One date in the date strip. Built on the server by `toDateChips`. */
export type DateChipVM = {
  date: string; // YYYY-MM-DD (cinema-local)
  href: string;
  day: string; // "25"
  weekday: string; // "Wed"
  ariaLabel: string; // "Wednesday, November 25"
  isSelected: boolean;
  /** Month tab label, e.g. "DEC". The strip never mixes two months on one page. */
  monthLabel: string;
};

/** Presenter helper: dates → chips, with each date's link supplied by the caller. */
export function toDateChips(dates: string[], selected: string, hrefFor: (date: string) => string): DateChipVM[] {
  return dates.map((date) => {
    const parts = dateParts(date);
    return {
      date,
      href: hrefFor(date),
      day: parts.day,
      weekday: parts.weekday,
      ariaLabel: parts.long,
      isSelected: date === selected,
      monthLabel: parts.monthShort.toUpperCase(),
    };
  });
}
