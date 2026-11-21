import { DashboardScreen } from "@/features/staff/dashboard-screen";
import { getDashboardViewModel, type DashboardParams } from "@/features/staff/dashboard-view-model";
import { StaffShell } from "@/features/staff/staff-shell";
import { requireStaff } from "@/server/staff-auth";

export const dynamic = "force-dynamic"; // live seat and booking data

export default async function StaffDashboardPage({ searchParams }: { searchParams: Promise<DashboardParams> }) {
  const staff = await requireStaff("dashboard.view"); // signed-out visitors go to the login
  const vm = await getDashboardViewModel(staff, await searchParams);
  return (
    <StaffShell activeHref="/staff/dashboard" staff={staff}>
      <DashboardScreen vm={vm} />
    </StaffShell>
  );
}
