"use client";

import { useEffect, useMemo, useState } from "react";
import { ROLE_LABEL, type StaffRole } from "@/server/permissions";
import type { AdminUserVM } from "./admin-view-model";

type Pending = { role?: StaffRole; active?: boolean };

export type StaffChangeLine = { targetId: string; username: string; description: string };

/**
 * ViewModel for editing staff access: role and status edits are kept as pending
 * changes until the admin reviews and confirms them. Nothing is saved before that.
 */
export function useStaffChanges(users: AdminUserVM[]) {
  const [pending, setPending] = useState<Record<string, Pending>>({});

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Drop a field once it matches the saved value again, so "change back" isn't a change.
  const update = (id: string, patch: Pending) =>
    setPending((prev) => {
      const user = byId.get(id);
      if (!user) return prev;
      const next: Pending = { ...prev[id], ...patch };
      if (next.role === user.role) delete next.role;
      if (next.active === user.isActive) delete next.active;
      const rest = { ...prev };
      delete rest[id];
      return Object.keys(next).length ? { ...rest, [id]: next } : rest;
    });

  const lines: StaffChangeLine[] = useMemo(
    () =>
      Object.entries(pending).flatMap(([id, p]) => {
        const user = byId.get(id)!;
        const out: StaffChangeLine[] = [];
        if (p.role) out.push({ targetId: id, username: user.username, description: `${ROLE_LABEL[user.role]} → ${ROLE_LABEL[p.role]}` });
        if (p.active !== undefined) out.push({ targetId: id, username: user.username, description: p.active ? "Reactivate account" : "Deactivate account" });
        return out;
      }),
    [pending, byId],
  );

  const changeCount = lines.length;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (changeCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changeCount]);

  return {
    roleOf: (u: AdminUserVM) => pending[u.id]?.role ?? u.role,
    activeOf: (u: AdminUserVM) => pending[u.id]?.active ?? u.isActive,
    isChanged: (u: AdminUserVM) => u.id in pending,
    setRole: (id: string, role: StaffRole) => update(id, { role }),
    toggleActive: (u: AdminUserVM) => update(u.id, { active: !(pending[u.id]?.active ?? u.isActive) }),
    discard: () => setPending({}),
    lines,
    changeCount,
    /** Payload for the server action: one entry per account. */
    payload: JSON.stringify(Object.entries(pending).map(([targetId, p]) => ({ targetId, ...p }))),
  };
}
