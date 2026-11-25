"use client";

import Link from "next/link";
import { useState } from "react";
import { focusRing } from "@/components/ui/icon-button";
import { ROLE_LABEL } from "@/lib/permissions";
import type { AdminVM } from "./admin-view-model";
import { ConfirmStaffChangesDialog } from "./confirm-staff-changes-dialog";
import { RoleSelect } from "./role-select";
import { useStaffChanges } from "./use-staff-changes";

const ROLE_BADGE = {
  admin: "bg-marquee-500/15 text-marquee-400",
  privileged: "bg-blue-500/15 text-blue-300",
  viewer: "bg-white/10 text-neutral-300",
} as const;

/** View: staff accounts with editable role and status; edits are confirmed in one step. */
export function StaffAccountsTable({ vm }: { vm: AdminVM }) {
  const changes = useStaffChanges(vm.users);
  const [isReviewing, setReviewing] = useState(false);

  return (
    <section aria-labelledby="accounts-title" className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h1 id="accounts-title" className="text-lg font-semibold text-white">Staff accounts</h1>
        <p className="text-xs text-neutral-500">{vm.counts}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-900 text-xs uppercase tracking-wider text-neutral-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">User</th>
              <th scope="col" className="px-4 py-3 font-medium">Role</th>
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {vm.users.map((u) => {
              const changed = changes.isChanged(u);
              const active = changes.activeOf(u);
              return (
                <tr
                  key={u.id}
                  className={
                    changed
                      ? "bg-marquee-500/10 shadow-[inset_3px_0_0_var(--color-marquee-400)]"
                      : u.isSelected
                        ? "bg-white/[0.04]"
                        : "hover:bg-white/[0.03]"
                  }
                >
                  <td className="px-4 py-3">
                    <Link href={u.href} className={`font-medium text-white hover:text-marquee-400 ${focusRing}`}>
                      {u.username}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      {u.name}
                      {u.isSelf && " (you)"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {u.isSelf ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role]}`}>{u.roleLabel}</span>
                    ) : (
                      <>
                        <RoleSelect
                          value={changes.roleOf(u)}
                          roles={vm.roles}
                          label={`Role for ${u.username}`}
                          onChange={(role) => changes.setRole(u.id, role)}
                        />
                        {changes.roleOf(u) !== u.role && (
                          <p className="mt-1 text-[11px] text-marquee-400">was {ROLE_LABEL[u.role]}</p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    <span className="tabular-nums">{u.actionCount}</span>
                    <p className="text-xs text-neutral-500">{u.lastAction}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.isSelf ? (
                      <span className="text-xs text-neutral-400">Active</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => changes.toggleActive(u)}
                        aria-pressed={!active}
                        aria-label={`${active ? "Deactivate" : "Reactivate"} ${u.username}`}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${focusRing} ${
                          active ? "text-neutral-300 hover:bg-red-500/10 hover:text-red-300" : "bg-red-500/10 text-red-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {active ? "Active · Deactivate" : "Inactive · Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending-changes bar: nothing is saved until the admin confirms. */}
      <div
        aria-live="polite"
        className={`sticky bottom-4 mt-3 flex items-center justify-between gap-4 rounded-xl border border-marquee-400/30 bg-neutral-900/95 px-4 py-3 shadow-xl backdrop-blur transition ${
          changes.changeCount ? "opacity-100" : "pointer-events-none invisible opacity-0"
        }`}
      >
        <p className="text-sm text-neutral-200">
          <span className="font-semibold text-marquee-400">{changes.changeCount}</span> unsaved change
          {changes.changeCount === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={changes.discard}
            className={`rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 transition hover:bg-white/10 hover:text-white ${focusRing}`}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className={`rounded-lg bg-marquee-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 ${focusRing}`}
          >
            Review &amp; confirm
          </button>
        </div>
      </div>

      <ConfirmStaffChangesDialog
        isOpen={isReviewing && changes.changeCount > 0}
        lines={changes.lines}
        payload={changes.payload}
        onCancel={() => setReviewing(false)}
      />
    </section>
  );
}
