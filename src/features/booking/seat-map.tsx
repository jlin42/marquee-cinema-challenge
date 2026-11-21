import { Icon } from "@/components/ui/icon";
import type { SeatLayoutVM, SeatVM } from "./seat-model";

/**
 * View: the auditorium, drawn from each seat's stored x/y position.
 * Row letters on both sides; the screen at the top.
 */
export function SeatMap({
  layout,
  selectedIds,
  interactive,
  onToggle,
}: {
  layout: SeatLayoutVM;
  selectedIds: string[];
  interactive: boolean;
  onToggle: (seat: SeatVM) => void;
}) {
  const columns = `1.5rem repeat(${layout.columns}, minmax(0, 2rem)) 1.5rem`;
  // Rows without seats are cross-aisles: give them visible height.
  const seatRows = new Set(layout.rows.map((r) => r.y));
  const lastY = Math.max(-1, ...layout.rows.map((r) => r.y));
  const rowsTemplate = Array.from({ length: lastY + 1 }, (_, y) => (seatRows.has(y) ? "auto" : "1.75rem")).join(" ");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ScreenArc />
      <div role="grid" aria-label="Seat map" className="mx-auto grid w-fit max-w-full gap-1 sm:gap-1.5" style={{ gridTemplateColumns: columns, gridTemplateRows: rowsTemplate }}>
        {layout.rows.map((row) => (
          <RowLabels key={row.y} label={row.label} y={row.y} lastColumn={layout.columns + 2} />
        ))}
        {layout.seats.map((seat) => (
          <SeatButton
            key={seat.id}
            seat={seat}
            isSelected={selectedIds.includes(seat.id)}
            interactive={interactive}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

function ScreenArc() {
  return (
    <div aria-hidden className="mx-auto mb-10 w-4/5">
      <div className="h-8 rounded-[100%/100%_100%_0_0] border-t-4 border-marquee-400/80 shadow-[0_-12px_30px_-10px] shadow-marquee-400/40" />
      <p className="-mt-4 text-center text-xs font-medium uppercase tracking-[0.4em] text-neutral-500">Screen</p>
    </div>
  );
}

function RowLabels({ label, y, lastColumn }: { label: string; y: number; lastColumn: number }) {
  const cls = "flex items-center justify-center text-xs font-medium text-neutral-500";
  return (
    <>
      <span aria-hidden className={cls} style={{ gridColumn: 1, gridRow: y + 1 }}>
        {label}
      </span>
      <span aria-hidden className={cls} style={{ gridColumn: lastColumn, gridRow: y + 1 }}>
        {label}
      </span>
    </>
  );
}

/** DOM id of a seat's button, so popovers can anchor to it. */
export const seatElementId = (seatId: string) => `seat-${seatId}`;

const KIND_NAME = { standard: "", wheelchair: ", wheelchair space", companion: ", companion seat next to a wheelchair space" } as const;

function SeatButton({
  seat,
  isSelected,
  interactive,
  onToggle,
}: {
  seat: SeatVM;
  isSelected: boolean;
  interactive: boolean;
  onToggle: (seat: SeatVM) => void;
}) {
  const isTaken = seat.state === "taken";
  const isOurs = isSelected || seat.state === "mine";
  const status = isTaken ? "booked" : isOurs ? "selected" : "available";
  const isWheelchair = seat.kind === "wheelchair";

  // Blue = available, Marquee yellow = selected, grey and smaller with an × = booked.
  // Wheelchair spaces use the access blue of disability parking signs, with a white symbol.
  const color = isOurs
    ? "bg-marquee-500 text-neutral-950"
    : isTaken
      ? "scale-[0.72] bg-neutral-700 text-neutral-400"
      : isWheelchair
        ? `bg-access-blue text-white ${interactive ? "hover:bg-access-blue-hover" : ""}`
        : `bg-blue-500 text-blue-950 ${interactive ? "hover:bg-blue-400" : ""}`;

  return (
    <button
      id={seatElementId(seat.id)}
      type="button"
      role="gridcell"
      aria-label={`Row ${seat.row}, seat ${seat.number}${KIND_NAME[seat.kind]}, ${status}`}
      aria-pressed={isOurs}
      disabled={isTaken || !interactive}
      onClick={() => onToggle(seat)}
      style={{ gridColumn: seat.x + 2, gridRow: seat.y + 1 }}
      className={`flex aspect-square w-full items-center justify-center rounded-t-lg rounded-b-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed ${color} ${
        interactive && !isTaken ? "cursor-pointer" : ""
      }`}
    >
      {isWheelchair ? (
        <Icon name="wheelchair" className="h-3.5 w-3.5" />
      ) : isTaken ? (
        <Icon name="x" className="h-3.5 w-3.5" />
      ) : isOurs ? (
        <Icon name="check" className="h-3.5 w-3.5" />
      ) : null}
    </button>
  );
}

/** View: what each seat color and icon means. */
export function SeatLegend() {
  const items = [
    { label: "Available", swatch: "bg-blue-500" },
    { label: "Selected", swatch: "bg-marquee-500" },
  ];
  return (
    <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-neutral-400">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span aria-hidden className={`h-4 w-4 rounded-t-md rounded-b-sm ${i.swatch}`} />
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span aria-hidden className="flex h-4 w-4 items-center justify-center">
          <span className="flex h-3 w-3 items-center justify-center rounded-t-[3px] rounded-b-[1px] bg-neutral-700 text-neutral-400">
            <Icon name="x" className="h-2 w-2" />
          </span>
        </span>
        Booked
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-t-md rounded-b-sm bg-access-blue text-white">
          <Icon name="wheelchair" className="h-3 w-3" />
        </span>
        Wheelchair space
      </li>
    </ul>
  );
}
