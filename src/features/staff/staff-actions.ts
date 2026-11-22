"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelBooking, moveBooking } from "@/server/booking-admin";
import { applyStaffChanges } from "@/server/staff-admin";
import { requireStaff } from "@/server/staff-auth";

const Uuid = z.uuid();

export type ActionState = { error: string | null; done?: boolean };

/** Privileged: cancel a customer's booking (seats go back on sale). Audited. */
export async function cancelBookingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff("bookings.manage");
  const bookingId = Uuid.safeParse(form.get("bookingId"));
  if (!bookingId.success) return { error: "Invalid booking." };
  const result = await cancelBooking({ actorId: staff.id, bookingId: bookingId.data });
  if (!result.ok) return { error: result.message };
  revalidatePath("/staff", "layout");
  return { error: null, done: true };
}

/** Privileged: move a booking to the chosen seats. Audited. Redirects to that showing's dashboard. */
export async function moveBookingAction(input: { bookingId: string; showingId: string; seatIds: string[] }): Promise<ActionState> {
  const staff = await requireStaff("bookings.manage");
  const parsed = z
    .object({ bookingId: Uuid, showingId: Uuid, seatIds: z.array(Uuid).min(1).max(20) })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const result = await moveBooking({ actorId: staff.id, ...parsed.data, toShowingId: parsed.data.showingId });
  if (!result.ok) return { error: result.message };
  revalidatePath("/staff", "layout");
  redirect(`/staff/dashboard?showingId=${result.showingId}&notice=moved`);
}

export type StaffChangesState = { error: string | null };

const StaffChanges = z
  .array(
    z.object({
      targetId: Uuid,
      role: z.enum(["admin", "privileged", "viewer"]).optional(),
      active: z.boolean().optional(),
    }),
  )
  .min(1)
  .max(100);

/**
 * Admin: apply a reviewed batch of role and status changes, all or nothing. Each change
 * is audited; affected staff are signed out so their new rights apply at once.
 */
export async function applyStaffChangesAction(_prev: StaffChangesState, form: FormData): Promise<StaffChangesState> {
  const staff = await requireStaff("staff.manage");
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("changes") ?? ""));
  } catch {
    return { error: "Invalid request." };
  }
  const parsed = StaffChanges.safeParse(raw);
  if (!parsed.success) return { error: "Invalid request." };

  const result = await applyStaffChanges({ actorId: staff.id, changes: parsed.data });
  if (!result.ok) return { error: result.message };
  revalidatePath("/staff", "layout");
  redirect("/staff/admin?notice=saved");
}

export type DemoDataState = { message: string | null; error: string | null };

/** Demo tools run in development, or in a deployment that sets DEMO_TOOLS=1. */
export async function demoToolsEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_TOOLS === "1";
}

/**
 * Admin: fill the database with demo bookings (if it has none) and demo staff with their
 * action history (if the admin is the only account). Never deletes or changes existing data.
 */
export async function loadDemoDataAction(_prev: DemoDataState): Promise<DemoDataState> {
  await requireStaff("staff.manage");
  if (!(await demoToolsEnabled())) return { message: null, error: "Demo tools are turned off here." };
  try {
    const { topUpDemoData } = await import("@/db/demo-data");
    const result = await topUpDemoData();
    revalidatePath("/", "layout");
    return { message: `${result.demoBookings} ${result.demoStaff}`, error: null };
  } catch (err) {
    console.error(err);
    return { message: null, error: err instanceof Error ? err.message : "Loading demo data failed." };
  }
}
