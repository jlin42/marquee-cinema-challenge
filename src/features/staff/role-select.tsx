"use client";

import type { StaffRole } from "@/server/permissions";

/** View: role dropdown. Controlled; changes stay pending until confirmed. */
export function RoleSelect({
  value,
  roles,
  label,
  onChange,
}: {
  value: StaffRole;
  roles: { value: StaffRole; label: string }[];
  label: string;
  onChange: (role: StaffRole) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value as StaffRole)}
      className="rounded-md border border-white/15 bg-neutral-900 px-2 py-1 text-xs text-white focus:border-marquee-400 focus:outline-none"
    >
      {roles.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
