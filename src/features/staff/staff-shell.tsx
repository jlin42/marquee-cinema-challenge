import Link from "next/link";
import { focusRing } from "@/components/ui/icon-button";
import { can, ROLE_LABEL } from "@/server/permissions";
import type { StaffUser } from "@/server/staff-auth";
import { logoutAction } from "./auth-actions";

// Tabs appear only for roles allowed to use them (the pages check again on the server).
const TABS = [
  { href: "/staff/dashboard", label: "Dashboard", permission: "dashboard.view" },
  { href: "/staff/movies", label: "Movies", permission: "bookings.manage" },
  { href: "/staff/admin", label: "Admin", permission: "staff.manage" },
] as const;

/** View: staff site frame: brand, tabs for this role, who's signed in, sign out. */
export function StaffShell({
  activeHref,
  staff,
  children,
}: {
  activeHref: string;
  staff: StaffUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-neutral-950">
        <div className="flex items-center justify-between gap-4 px-4 pt-4 sm:px-8">
          <p className="font-display text-2xl tracking-[0.2em] text-white">
            Marquee<span className="text-marquee-400">.</span>
            <span className="ml-3 align-middle font-sans text-xs font-semibold uppercase tracking-widest text-neutral-500">Staff</span>
          </p>
          <div className="flex items-center gap-4 text-sm text-neutral-400">
            <span className="hidden sm:inline">
              {staff.username} <span className="text-neutral-600">·</span> {ROLE_LABEL[staff.role]}
            </span>
            <form action={logoutAction}>
              <button type="submit" className={`rounded-md px-2 py-1 text-neutral-300 transition hover:bg-white/10 hover:text-white ${focusRing}`}>
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Staff" className="mt-3 flex gap-1 px-4 sm:px-8">
          {TABS.filter((t) => can(staff, t.permission)).map((t) => {
            const active = t.href === activeHref;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`border-b-2 px-3 pb-3 text-sm font-medium transition ${focusRing} ${
                  active ? "border-marquee-400 text-white" : "border-transparent text-neutral-400 hover:text-white"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {/* Full width: staff screens are data-heavy, so they use the whole window. */}
      <div className="px-4 py-8 sm:px-8">{children}</div>
    </div>
  );
}
