import { AdminScreen } from "@/features/staff/admin-screen";
import { getAdminViewModel } from "@/features/staff/admin-view-model";
import { StaffShell } from "@/features/staff/staff-shell";
import { requireStaff } from "@/server/staff-auth";

export const dynamic = "force-dynamic";

export default async function StaffAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; notice?: string; error?: string }>;
}) {
  const staff = await requireStaff("staff.manage");
  const vm = await getAdminViewModel(staff, await searchParams);
  return (
    <StaffShell activeHref="/staff/admin" staff={staff}>
      <AdminScreen vm={vm} />
    </StaffShell>
  );
}
