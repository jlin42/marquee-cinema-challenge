/** Date/time helpers. Showtimes are always shown in the cinemas' local time (all in Virginia). */
export const CINEMA_TIME_ZONE = "America/New_York";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: CINEMA_TIME_ZONE });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: CINEMA_TIME_ZONE });
const longDateFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: CINEMA_TIME_ZONE });
const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: CINEMA_TIME_ZONE }); // YYYY-MM-DD

/** "7:45 PM" */
export const formatTime = (d: Date) => timeFmt.format(d);

/** "Saturday, November 21" */
export const formatLongDate = (d: Date) => longDateFmt.format(d);

/** Cinema-local calendar date, "YYYY-MM-DD". */
export const cinemaDate = (d: Date) => isoDateFmt.format(d);

/** The cinema-local date `offset` days from now. */
export const cinemaDateFromToday = (offset: number) => cinemaDate(new Date(Date.now() + offset * 86_400_000));

/** "Today", "Tomorrow", or a short weekday. */
export function dayLabel(d: Date) {
  const key = cinemaDate(d);
  if (key === cinemaDateFromToday(0)) return "Today";
  if (key === cinemaDateFromToday(1)) return "Tomorrow";
  return weekdayFmt.format(d);
}

/** "2h 22m" */
export function runtimeLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Parts of a cinema-local date string (YYYY-MM-DD) for the date strip. */
export function dateParts(date: string) {
  const noon = new Date(`${date}T17:00:00Z`); // midday in Virginia, safely inside that date
  const [, month, day] = date.split("-");
  return {
    day: String(Number(day)), // "1", "25"
    month: month!, // "12", used to detect a new month
    weekday: weekdayFmt.format(noon), // "Fri"
    monthShort: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: CINEMA_TIME_ZONE }).format(noon), // "Jan"
    long: longDateFmt.format(noon), // "Friday, January 1"
  };
}
