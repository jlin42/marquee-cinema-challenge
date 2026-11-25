"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SeatVM } from "@/features/booking/seat-model";
import { moveBookingAction } from "./staff-actions";
import type { StaffSeatPickerVM } from "./staff-movies-view-model";

/**
 * View-model hook for the staff seat picker: selection rules for the booking being
 * modified, opening a booked seat's booking, and calling the server to move it.
 */
export function useStaffSeatPicker(vm: StaffSeatPickerVM) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(vm.initialSelection);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const required = vm.modifying?.seatCount ?? 0;

  const toggle = (seat: SeatVM) => {
    if (!vm.modifying || seat.state === "taken") return;
    setError(null);
    if (selected.includes(seat.id)) setSelected(selected.filter((id) => id !== seat.id));
    else if (selected.length < required) setSelected([...selected, seat.id]);
    else setError(`This booking has ${required} ${required === 1 ? "seat" : "seats"}. Deselect one first.`);
  };

  // Not modifying yet: clicking a booked seat opens that booking for modifying here.
  const openBooking = (seat: SeatVM) => {
    const bookingId = vm.bookingBySeat[seat.id];
    if (bookingId) router.push(`/staff/movies/${vm.showingId}?modify=${bookingId}`);
  };

  const move = () =>
    startTransition(async () => {
      if (!vm.modifying) return;
      const result = await moveBookingAction({ bookingId: vm.modifying.bookingId, showingId: vm.showingId, seatIds: selected });
      if (result?.error) {
        setError(result.error);
        router.refresh(); // pull fresh seat states
      }
    });

  return {
    selected,
    required,
    error,
    isPending,
    canMove: selected.length === required && !isPending,
    toggle,
    openBooking,
    move,
  };
}
