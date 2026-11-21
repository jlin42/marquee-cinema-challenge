import { StaffMoviesScreen } from "@/features/staff/staff-movies-screen";
import { getStaffMoviesViewModel } from "@/features/staff/staff-movies-view-model";
import { StaffShell } from "@/features/staff/staff-shell";
import { requireStaff } from "@/server/staff-auth";

export const dynamic = "force-dynamic";

export default async function StaffMoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; date?: string; modify?: string }>;
}) {
  const staff = await requireStaff("bookings.manage");
  const vm = await getStaffMoviesViewModel(await searchParams);
  return (
    <StaffShell activeHref="/staff/movies" staff={staff}>
      <StaffMoviesScreen vm={vm} />
    </StaffShell>
  );
}
