import Link from "next/link";
import { focusRing } from "@/components/ui/icon-button";
import type { AdminVM } from "./admin-view-model";
import { StaffAccountsTable } from "./staff-accounts-table";

/** View: the Admin tab (accounts with roles and status, and the action history). */
export function AdminScreen({ vm }: { vm: AdminVM }) {
  return (
    // Same reading width as the Movies tab.
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {vm.notice && <p role="status" className="rounded-lg border border-marquee-400/30 bg-marquee-500/10 px-4 py-3 text-sm text-marquee-400">{vm.notice}</p>}
      {vm.error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{vm.error}</p>}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Keyed by the saved state, so pending edits reset after a save. */}
        <StaffAccountsTable key={vm.accountsVersion} vm={vm} />

        <section aria-labelledby="history-title" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="history-title" className="text-lg font-semibold text-white">{vm.history.title}</h2>
            <Link href="/staff/admin" className={`text-xs text-neutral-400 underline underline-offset-2 hover:text-white ${focusRing}`}>
              All staff
            </Link>
          </div>
          {vm.history.entries.length === 0 ? (
            <p className="rounded-xl bg-white/[0.03] px-4 py-8 text-center text-sm text-neutral-400">No actions yet.</p>
          ) : (
            <ol className="divide-y divide-white/5 rounded-xl border border-white/10">
              {vm.history.entries.map((e) => (
                <li key={e.id} className="px-4 py-3 text-sm">
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-white">{e.action}</span>
                    <span className="text-xs text-neutral-500">{e.when} · {e.actor}</span>
                  </p>
                  <p className="mt-0.5 text-neutral-400">{e.summary}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
