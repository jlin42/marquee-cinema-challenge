/**
 * Auditorium layouts as text maps: one string per row, the screen at the top.
 *
 *   s = standard seat   w = wheelchair space   c = companion seat   . = aisle / no seat
 *
 * Each character is one grid column (x); each string is one row (y, 0 = nearest the
 * screen). A row of only "." is a cross-aisle: it takes up space but gets no letter.
 * Every room has a 4-row front section, a cross-aisle, then an accessible row whose
 * middle holds wheelchair spaces (each beside a companion seat) with gaps between them.
 *
 * Parsing turns a map into `seats` rows, so the database stores the real position of
 * every seat and the booking page can draw the room from it.
 */
export const LAYOUTS = {
  /** Screen 1: large auditorium, three seating blocks. */
  large: [
    "..ss.ssssssss.ss..",
    ".sss.ssssssss.sss.",
    "ssss.ssssssss.ssss",
    "ssss.ssssssss.ssss",
    "..................", // cross-aisle
    "ssss.wc.wc.wc.ssss", // accessible row: wheelchair spaces with companions, spaced apart
    "ssss.ssssssss.ssss",
    "ssss.ssssssss.ssss",
    "ssss.ssssssss.ssss",
    "ssss.ssssssss.ssss",
  ],
  /** Screen 2: standard auditorium. */
  standard: [
    ".ss.ssssssss.ss.",
    "sss.ssssssss.sss",
    "sss.ssssssss.sss",
    "sss.ssssssss.sss",
    "................", // cross-aisle
    "sss.wc.wc.wc.sss", // accessible row
    "sss.ssssssss.sss",
    "sss.ssssssss.sss",
    "sss.ssssssss.sss",
  ],
  /** Screen 3: small boutique room with a center aisle. */
  small: [
    "ssss.ssss",
    "ssss.ssss",
    "ssss.ssss",
    "ssss.ssss",
    ".........", // cross-aisle
    "s.wc.cw.s", // accessible row
    "ssss.ssss",
  ],
} as const satisfies Record<string, readonly string[]>;

export type LayoutName = keyof typeof LAYOUTS;

export type ParsedSeat = {
  rowLabel: string;
  number: number;
  type: "standard" | "wheelchair" | "companion";
  x: number;
  y: number;
};

// Cinemas skip I and O so they aren't confused with 1 and 0.
const ROW_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

const SEAT_TYPES = { s: "standard", w: "wheelchair", c: "companion" } as const;

/** Turn a text map into seats: rows lettered from the screen back (aisles skipped), seats numbered left to right. */
export function parseLayout(rows: readonly string[]): ParsedSeat[] {
  const width = rows[0]?.length ?? 0;
  let letterIndex = 0;
  return rows.flatMap((line, y) => {
    if (line.length !== width) throw new Error(`Layout row ${y} is ${line.length} wide, expected ${width}`);
    if (!/[^.]/.test(line)) return []; // cross-aisle: no seats, no letter

    const rowLabel = ROW_LETTERS[letterIndex++];
    if (!rowLabel) throw new Error(`Layout has more rows than letters (${rows.length})`);

    let number = 0;
    return line.split("").flatMap((ch, x) => {
      if (ch === ".") return [];
      const type = SEAT_TYPES[ch as keyof typeof SEAT_TYPES];
      if (!type) throw new Error(`Unknown layout character "${ch}" at row ${y}, column ${x}`);
      number += 1;
      return [{ rowLabel, number, type, x, y }];
    });
  });
}
