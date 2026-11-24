import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffSeatPicker } from "@/features/staff/staff-seat-picker";
import { getStaffSeatPickerViewModel } from "@/features/staff/staff-movies-view-model";
import { StaffShell } from "@/features/staff/staff-shell";
import { requireStaff } from "@/server/staff-auth";

export const dynamic = "force-dynamic";

export default async function StaffSeatPickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ showingId: string }>;
  searchParams: Promise<{ modify?: string }>;
}) {
  const staff = await requireStaff("bookings.manage");
  const showingId = z.uuid().safeParse((await params).showingId);
  const modify = z.uuid().safeParse((await searchParams).modify);
  if (!showingId.success) notFound();

  const vm = await getStaffSeatPickerViewModel(showingId.data, modify.success ? modify.data : undefined);
  if (!vm) notFound();
  return (
    <StaffShell activeHref="/staff/movies" staff={staff}>
      {/* Keyed by showing and booking: entering (or leaving) modify mode starts a fresh
          selection, so the booking's seats show highlighted and Back resets it. */}
      <StaffSeatPicker key={`${vm.showingId}:${vm.modifying?.bookingId ?? ""}`} vm={vm} />
    </StaffShell>
  );
}
