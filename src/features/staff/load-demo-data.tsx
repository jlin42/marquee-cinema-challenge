"use client";

import { useActionState } from "react";
import { Loader } from "@/components/ui/loader";
import { focusRing } from "@/components/ui/icon-button";
import { loadDemoDataAction, type DemoDataState } from "./staff-actions";

/** View: admin-only "Load demo data" panel (adds what's missing; deletes nothing). */
export function LoadDemoData() {
  const [state, action, isPending] = useActionState<DemoDataState, FormData>(loadDemoDataAction, { message: null, error: null });
  return (
    <section aria-labelledby="demo-data-title" className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h2 id="demo-data-title" className="text-sm font-semibold text-white">Demo data</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Adds demo bookings if there are none yet (around any real bookings, which are never touched), and the demo
        staff accounts with their history if you’re the only account. Takes up to a minute.
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50 ${focusRing}`}
        >
          {isPending ? "Loading demo data…" : "Load demo data"}
        </button>
        {isPending && <Loader caption="This can take a minute" />}
      </form>
      {state.message && <p role="status" className="mt-3 text-sm text-marquee-400">{state.message}</p>}
      {state.error && <p role="alert" className="mt-3 text-sm text-red-300">{state.error}</p>}
    </section>
  );
}
