"use client";

import { useActionState, useState } from "react";
import { focusRing } from "@/components/ui/icon-button";
import { cancelBookingAction, type ActionState } from "./staff-actions";

/** View: two-step cancel ("Cancel" → "Confirm cancel") so a booking isn't cancelled by accident. */
export function CancelBookingButton({ bookingId, reference }: { bookingId: string; reference: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(cancelBookingAction, { error: null });

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className={`rounded-md px-2 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/10 ${focusRing}`}
      >
        Cancel
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={isPending}
          aria-label={`Confirm cancelling booking ${reference}`}
          className={`rounded-md bg-red-500/90 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60 ${focusRing}`}
        >
          {isPending ? "Cancelling…" : "Confirm cancel"}
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          className={`rounded-md px-2 py-1 text-xs text-neutral-400 hover:text-white ${focusRing}`}
        >
          Keep
        </button>
      </div>
      {state.error && <p role="alert" className="text-xs text-red-300">{state.error}</p>}
    </form>
  );
}
