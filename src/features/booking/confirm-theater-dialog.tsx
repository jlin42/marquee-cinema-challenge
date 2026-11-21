"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { useModalDialog } from "@/hooks/use-modal-dialog";

/** View: "Confirm Theater Location" modal shown before choosing seats. */
export function ConfirmTheaterDialog({
  isOpen,
  theater,
  showtimesHref,
  onConfirm,
}: {
  isOpen: boolean;
  theater: { name: string; address: string };
  showtimesHref: string;
  onConfirm: () => void;
}) {
  const ref = useModalDialog(isOpen);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-theater-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-neutral-900 p-0 text-neutral-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <h2 id="confirm-theater-title" className="border-b border-white/10 px-7 py-6 text-xl font-semibold">
        Confirm theater location
      </h2>

      <div className="px-7 py-8">
        <div className="flex gap-4">
          <span className="flex flex-col items-center text-neutral-300">
            <Icon name="pin" className="h-6 w-6" />
            <span aria-hidden className="mt-1 h-6 border-l-2 border-dashed border-neutral-500" />
          </span>
          <div>
            <p className="text-lg font-bold uppercase tracking-wide text-white">{theater.name}</p>
            <p className="mt-1 text-neutral-300">{theater.address}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`rounded-lg bg-marquee-500 px-7 py-3 font-semibold text-neutral-950 transition hover:bg-marquee-400 ${focusRing}`}
          >
            Yes, that’s correct
          </button>
          <Link href={showtimesHref} className={`text-neutral-300 underline underline-offset-4 transition hover:text-white ${focusRing}`}>
            No, back to showtimes
          </Link>
        </div>

        <p className="mt-8 text-xs text-neutral-500">
          Note: you can see every theater playing this movie by switching theaters on the Movies page.
        </p>
      </div>
    </dialog>
  );
}
