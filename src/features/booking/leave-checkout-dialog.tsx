"use client";

import { focusRing } from "@/components/ui/icon-button";
import { useModalDialog } from "@/hooks/use-modal-dialog";

/** View: "Leave checkout?" — staying keeps the hold; leaving cancels it. */
export function LeaveCheckoutDialog({
  isOpen,
  seatLabels,
  isLeaving,
  onStay,
  onLeave,
}: {
  isOpen: boolean;
  seatLabels: string[];
  isLeaving: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  const ref = useModalDialog(isOpen, isLeaving ? undefined : onStay);
  const seats = seatLabels.length ? seatLabels.join(", ") : "your seats";

  return (
    <dialog
      ref={ref}
      aria-labelledby="leave-checkout-title"
      aria-describedby="leave-checkout-body"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-neutral-900 p-0 text-neutral-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="px-6 py-6">
        <h2 id="leave-checkout-title" className="text-lg font-semibold text-white">
          Leave checkout?
        </h2>
        <p id="leave-checkout-body" className="mt-2 text-sm leading-relaxed text-neutral-300">
          You’re holding <span className="font-medium text-white">{seats}</span>. If you leave, your hold will be
          cancelled and the seats go back on sale for everyone.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onLeave}
            disabled={isLeaving}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50 ${focusRing}`}
          >
            {isLeaving ? "Releasing seats…" : "Leave and cancel hold"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onStay}
            disabled={isLeaving}
            className={`rounded-lg bg-marquee-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 disabled:opacity-60 ${focusRing}`}
          >
            Stay and finish booking
          </button>
        </div>
      </div>
    </dialog>
  );
}
