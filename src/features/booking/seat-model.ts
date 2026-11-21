/**
 * Seat view model and mapping, shared by the server presenter (first render)
 * and the client hook (live refreshes). Pure: no React, no server imports.
 */
export type SeatKind = "standard" | "wheelchair" | "companion";
export type SeatState = "available" | "taken" | "mine";

export type SeatVM = {
  id: string;
  label: string; // "C7"
  row: string;
  number: number;
  x: number;
  y: number;
  kind: SeatKind;
  state: SeatState;
};

export type SeatLayoutVM = {
  columns: number;
  rows: { y: number; label: string }[];
  seats: SeatVM[];
};

/** Shape returned by GET /api/showings/:id (and by the booking service's getSeatMap). */
export type ApiSeat = {
  id: string;
  row: string;
  number: number;
  type: SeatKind;
  x: number;
  y: number;
  status: "available" | "held" | "booked";
  mine: boolean;
};

export function toSeatVM(s: ApiSeat): SeatVM {
  return {
    id: s.id,
    label: `${s.row}${s.number}`,
    row: s.row,
    number: s.number,
    x: s.x,
    y: s.y,
    kind: s.type,
    state: s.mine ? "mine" : s.status === "available" ? "available" : "taken",
  };
}

/** Grid size and row labels from the seats' positions. */
export function toSeatLayout(apiSeats: ApiSeat[]): SeatLayoutVM {
  const seats = apiSeats.map(toSeatVM);
  const rows = new Map<number, string>();
  for (const s of seats) rows.set(s.y, s.row);
  return {
    columns: seats.reduce((max, s) => Math.max(max, s.x + 1), 0),
    rows: [...rows.entries()].sort(([a], [b]) => a - b).map(([y, label]) => ({ y, label })),
    seats,
  };
}

/** "A3, A4, A5" in row/number order. */
export function seatLabels(seats: SeatVM[], ids: Iterable<string>): string[] {
  const wanted = new Set(ids);
  return seats
    .filter((s) => wanted.has(s.id))
    .sort((a, b) => a.y - b.y || a.number - b.number)
    .map((s) => s.label);
}
