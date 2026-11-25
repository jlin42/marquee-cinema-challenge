"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { SeatLegend, SeatMap } from "@/features/booking/seat-map";
import { ModifyBanner } from "./staff-movies-screen";
import type { StaffSeatPickerVM } from "./staff-movies-view-model";
import { useStaffSeatPicker } from "./use-staff-seat-picker";

/** View: the staff seat picker. State and server calls live in useStaffSeatPicker. */
export function StaffSeatPicker({ vm }: { vm: StaffSeatPickerVM }) {
  const { selected, required, error, isPending, canMove, toggle, openBooking, move } = useStaffSeatPicker(vm);

  return (
    // Same width as the Movies tab it belongs to.
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {vm.modifying && <ModifyBanner modifying={vm.modifying} />}
      <div>
        <Link href={vm.backHref} className={`mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white ${focusRing}`}>
          <Icon name="arrow-left" className="h-4 w-4" />
          Showtimes
        </Link>
        <h1 className="text-2xl font-semibold text-white">{vm.title}</h1>
        <p className="text-sm text-neutral-400">
          {vm.when} · {vm.where}
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <SeatMap
          layout={vm.layout}
          selectedIds={selected}
          interactive={Boolean(vm.modifying)}
          onToggle={toggle}
          onTakenSeat={vm.modifying ? undefined : openBooking}
        />
        <SeatLegend />
      </section>

      {vm.modifying ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-neutral-900 px-5 py-4">
          <p className="text-sm text-neutral-300">
            {selected.length} of {required} {required === 1 ? "seat" : "seats"} chosen
            {error && <span role="alert" className="ml-3 text-red-300">{error}</span>}
          </p>
          <button
            type="button"
            onClick={move}
            disabled={!canMove}
            className={`rounded-lg bg-marquee-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-marquee-400 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            {isPending ? "Moving…" : `Move booking ${vm.modifying.reference} here`}
          </button>
        </div>
      ) : null}
      {vm.modifying && vm.otherShowtimesHref ? (
        <Link href={vm.otherShowtimesHref} className={`self-start text-sm text-neutral-400 underline underline-offset-4 hover:text-white ${focusRing}`}>
          Move to a different showtime instead
        </Link>
      ) : (
        <p className="text-sm text-neutral-400">Click a booked seat to modify that booking.</p>
      )}
    </div>
  );
}
