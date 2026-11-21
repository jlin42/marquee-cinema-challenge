"use client";

import { useEffect, useState } from "react";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import type { TicketCode } from "./booking-api";
import type { TicketOptionVM } from "./booking-view-model";
import { seatElementId } from "./seat-map";

/**
 * View: "Who is sitting in H9?" as a popover attached to the clicked seat,
 * with a small arrow pointing at it. Picking a ticket type selects the seat.
 */
export function TicketTypeDialog({
  seat,
  options,
  note,
  onChoose,
  onCancel,
}: {
  seat: { id: string; label: string } | null; // null = closed
  options: TicketOptionVM[];
  note: string;
  onChoose: (type: TicketCode, savePreference: boolean) => void;
  onCancel: () => void;
}) {
  const ref = useModalDialog(seat != null, onCancel);
  const [savePreference, setSavePreference] = useState(false);

  // The seat button this popover points at.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setAnchor(seat ? document.getElementById(seatElementId(seat.id)) : null);
  }, [seat]);
  const position = useAnchoredPosition(ref, anchor);

  return (
    <dialog
      ref={ref}
      aria-labelledby="ticket-type-title"
      style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
      className="absolute inset-auto m-0 w-[min(22rem,calc(100vw-1rem))] overflow-visible rounded-2xl bg-neutral-950 p-0 text-neutral-100 shadow-2xl ring-1 ring-white/10 backdrop:bg-black/30"
    >
      {seat && (
        <div>
          <div className="px-6 pt-6">
            <h2 id="ticket-type-title" className="text-xl font-bold text-white">
              Who is sitting in {seat.label}?
            </h2>
            {note && <p className="mt-1 text-sm text-neutral-400">{note}</p>}
          </div>

          <fieldset className="mt-4 px-6 pb-2">
            <legend className="sr-only">Ticket type for {seat.label}</legend>
            {options.map((option, i) => (
              <label
                key={option.code}
                className={`flex cursor-pointer items-center gap-4 py-5 ${i > 0 ? "border-t border-white/10" : ""}`}
              >
                <input
                  type="radio"
                  name="ticket-type"
                  value={option.code}
                  onChange={() => onChoose(option.code, savePreference)}
                  className="h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-neutral-500 bg-transparent transition hover:border-neutral-300 checked:border-marquee-500 checked:bg-marquee-500 checked:shadow-[inset_0_0_0_3px_var(--color-neutral-950)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquee-400"
                />
                <span className="flex-1 text-lg text-white">{option.label}</span>
                <span className="text-right">
                  <span className="block text-lg font-medium text-white">{option.total}</span>
                  <span className="block text-xs text-neutral-500">{option.breakdown}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="flex cursor-pointer items-center gap-3 rounded-b-2xl bg-neutral-900 px-6 py-4 text-sm font-medium uppercase tracking-wide text-neutral-200">
            <input
              type="checkbox"
              checked={savePreference}
              onChange={(e) => setSavePreference(e.target.checked)}
              className="h-4 w-4 accent-marquee-500"
            />
            Save seat preference
            <span className="sr-only">: use this ticket type for the next seats you pick</span>
          </label>
        </div>
      )}

      {position && <Arrow placement={position.placement} left={position.arrowLeft} />}
    </dialog>
  );
}

/**
 * The small triangle pointing from the popover to the seat: a rotated square clipped to
 * its outer half. Its border (same color as the popover's outline) shows on the two outer
 * edges; the open side sits over the popover's edge, so the outlines join seamlessly.
 */
function Arrow({ placement, left }: { placement: "top" | "bottom"; left: number }) {
  return (
    <span
      aria-hidden
      style={{ left }}
      className={`absolute h-4 w-4 -translate-x-1/2 rotate-45 border border-white/10 ${
        placement === "top" ? "bg-neutral-900" : "bg-neutral-950" // match the edge it sits on
      } ${
        placement === "top" ? "-bottom-2 [clip-path:polygon(100%_0,100%_100%,0_100%)]" : "-top-2 [clip-path:polygon(0_0,100%_0,0_100%)]"
      }`}
    />
  );
}
