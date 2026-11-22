import { BookingSearch } from "./booking-search";
import { DashboardFilters } from "./dashboard-filters";
import type { DashboardVM } from "./dashboard-view-model";
import { ShowingPanels } from "./showing-panels";

/** View: the staff dashboard (filters, stats, who-sits-where map, bookings). */
export function DashboardScreen({ vm }: { vm: DashboardVM }) {
  return (
    <div className="flex flex-col gap-8">
      {vm.notice && (
        <p role="status" className="rounded-lg border border-marquee-400/30 bg-marquee-500/10 px-4 py-3 text-sm text-marquee-400">
          {vm.notice}
        </p>
      )}
      <BookingSearch search={vm.search} />
      <DashboardFilters filters={vm.filters} />

      {!vm.showing ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-neutral-400">
          No showings on this screen that day.
        </p>
      ) : (
        <>
          <section aria-labelledby="showing-title">
            <h1 id="showing-title" className="text-2xl font-semibold text-white">
              {vm.showing.title}
            </h1>
            <p className="text-sm text-neutral-400">{vm.showing.when}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {vm.showing.stats.map((s) => (
                <div key={s.label} className="rounded-xl bg-white/[0.04] px-4 py-3">
                  <dt className="text-xs text-neutral-400">{s.label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Keyed by showing so a selected booking resets when the showing changes. */}
          <ShowingPanels key={vm.showing.id} showing={vm.showing} canManage={vm.canManageBookings} />
        </>
      )}
    </div>
  );
}
