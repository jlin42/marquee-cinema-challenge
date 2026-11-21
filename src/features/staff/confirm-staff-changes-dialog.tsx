"use client";

import { useActionState } from "react";
import { focusRing } from "@/components/ui/icon-button";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { applyStaffChangesAction, type StaffChangesState } from "./staff-actions";
import type { StaffChangeLine } from "./use-staff-changes";

/** View: review the pending access changes, then confirm (saves all of them) or go back. */
export function ConfirmStaffChangesDialog({
  isOpen,
  lines,
  payload,
  onCancel,
}: {
  isOpen: boolean;
  lines: StaffChangeLine[];
  payload: string;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState<StaffChangesState, FormData>(applyStaffChangesAction, { error: null });
  const ref = useModalDialog(isOpen, isPending ? undefined : onCancel);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-staff-changes-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-neutral-900 p-0 text-neutral-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <form action={formAction}>
        <input type="hidden" name="changes" value={payload} />
        <h2 id="confirm-staff-changes-title" className="border-b border-white/10 px-6 py-5 text-lg font-semibold">
          Confirm access changes
        </h2>

        <div className="px-6 py-5">
          {state.error && (
            <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {state.error} Nothing was saved.
            </p>
          )}

          <ul className="max-h-72 divide-y divide-white/5 overflow-auto rounded-lg border border-white/10 text-sm">
            {lines.map((l) => (
              <li key={`${l.targetId}-${l.description}`} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <span className="font-medium text-white">{l.username}</span>
                <span className={l.description.startsWith("Deactivate") ? "text-red-300" : "text-neutral-300"}>{l.description}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-neutral-400">
            Changes are saved together and recorded in the action log under your name. Affected staff are
            signed out so their new access applies right away.
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50 ${focusRing}`}
            >
              Go back
            </button>
            <button
              type="submit"
              autoFocus
              disabled={isPending}
              className={`rounded-lg bg-marquee-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 disabled:opacity-60 ${focusRing}`}
            >
              {isPending ? "Saving…" : `Confirm ${lines.length} change${lines.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
