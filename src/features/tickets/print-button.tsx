"use client";

import { focusRing } from "@/components/ui/icon-button";

/** View: prints the ticket (the page hides everything else when printing). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 ${focusRing}`}
    >
      Print ticket
    </button>
  );
}
