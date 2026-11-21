import { ROLE_LABEL, type StaffRole } from "@/server/permissions";
import type { StaffUser } from "@/server/staff-auth";
import { listActions, listStaffWithActivity } from "@/server/staff-admin";
import { cinemaDate, dateParts, formatTime } from "@/lib/time";

const ACTION_LABEL = {
  "booking.cancel": "Cancelled booking",
  "booking.move": "Moved booking",
  "staff.role_change": "Changed role",
  "staff.deactivate": "Deactivated account",
  "staff.activate": "Reactivated account",
} as const;

// Only these messages are shown from the URL, so a crafted link can't put arbitrary text on the page.
const KNOWN_ERRORS = new Set([
  "You can't change your own role.",
  "You can't deactivate your own account.",
  "There must always be at least one active admin.",
  "That account doesn't exist.",
]);

export type AdminUserVM = {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
  roleLabel: string;
  isActive: boolean;
  isSelf: boolean;
  isSelected: boolean;
  actionCount: number;
  lastAction: string;
  href: string;
};

export type AdminVM = {
  notice: string | null;
  error: string | null;
  roles: { value: StaffRole; label: string }[];
  counts: string; // "2 admins · 10 privileged · 30 viewers"
  /** Changes whenever saved roles or statuses change, so the editor resets after a save. */
  accountsVersion: string;
  users: AdminUserVM[];
  history: {
    title: string;
    entries: { id: string; when: string; actor: string; action: string; summary: string }[];
  };
};

const stamp = (d: Date) => {
  const p = dateParts(cinemaDate(d));
  return `${p.weekday} ${p.monthShort} ${p.day}, ${formatTime(d)}`;
};

/** Presenter for the Admin tab: accounts and the action history (all, or one person's). */
export async function getAdminViewModel(staff: StaffUser, params: { user?: string; notice?: string; error?: string }): Promise<AdminVM> {
  const users = await listStaffWithActivity();
  const selected = users.find((u) => u.id === params.user) ?? null;
  const entries = await listActions({ staffUserId: selected?.id, limit: selected ? 200 : 100 });
  const tally = (role: StaffRole) => users.filter((u) => u.role === role).length;

  return {
    notice: params.notice === "saved" ? "Changes saved and added to the action log. Affected staff were signed out so their new access applies right away." : null,
    error: params.error && KNOWN_ERRORS.has(params.error) ? params.error : params.error ? "That change couldn't be made." : null,
    roles: (Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] })),
    counts: `${tally("admin")} admins · ${tally("privileged")} privileged · ${tally("viewer")} viewers`,
    accountsVersion: users.map((u) => `${u.id}:${u.role}:${u.isActive ? 1 : 0}`).join("|"),
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      roleLabel: ROLE_LABEL[u.role],
      isActive: u.isActive,
      isSelf: u.id === staff.id,
      isSelected: u.id === selected?.id,
      actionCount: u.actionCount,
      lastAction: u.lastActionAt ? stamp(new Date(u.lastActionAt)) : "—",
      href: `/staff/admin?user=${u.id}`,
    })),
    history: {
      title: selected ? `Actions by ${selected.username}` : "Recent actions by all staff",
      entries: entries.map((e) => ({
        id: e.id,
        when: stamp(e.createdAt),
        actor: e.actor,
        action: ACTION_LABEL[e.action],
        summary: e.summary,
      })),
    },
  };
}
