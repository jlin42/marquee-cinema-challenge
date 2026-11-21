import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { focusRing } from "@/components/ui/icon-button";
import { CancelBookingButton } from "./cancel-booking-button";
import { DashboardFilters } from "./dashboard-filters";
import type { DashboardVM, StaffSeatVM } from "./dashboard-view-model";

/** View: the staff dashboard (filters, stats, who-sits-where map, bookings). */
export function DashboardScreen({ vm }: { vm: DashboardVM }) {
  return (
    <div className="flex flex-col gap-8">
      {vm.notice && (
        <p role="status" className="rounded-lg border border-marquee-400/30 bg-marquee-500/10 px-4 py-3 text-sm text-marquee-400">
          {vm.notice}
        </p>
      )}
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

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section aria-label="Seat map" className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <StaffSeatMap columns={vm.showing.columns} rows={vm.showing.rows} seats={vm.showing.seats} />
              <Legend />
            </section>
            <BookingsTable bookings={vm.showing.bookings} canManage={vm.canManageBookings} />
          </div>
        </>
      )}
    </div>
  );
}

const SEAT_COLOR: Record<StaffSeatVM["state"], string> = {
  sold: "bg-marquee-500 text-neutral-950",
  held: "bg-transparent ring-2 ring-inset ring-marquee-400 text-marquee-400",
  available: "bg-neutral-700 text-neutral-300",
};

function StaffSeatMap({ columns, rows, seats }: { columns: number; rows: { y: number; label: string }[]; seats: StaffSeatVM[] }) {
  const seatRows = new Set(rows.map((r) => r.y));
  const lastY = Math.max(-1, ...rows.map((r) => r.y));
  return (
    <div className="overflow-x-auto">
      <p aria-hidden className="mx-auto mb-4 w-3/4 border-t-4 border-marquee-400/70 pt-1 text-center text-[11px] uppercase tracking-[0.4em] text-neutral-500">
        Screen
      </p>
      <div
        className="mx-auto grid w-fit gap-1"
        style={{
          gridTemplateColumns: `1.25rem repeat(${columns}, 1.5rem)`,
          gridTemplateRows: Array.from({ length: lastY + 1 }, (_, y) => (seatRows.has(y) ? "1.5rem" : "1rem")).join(" "),
        }}
      >
        {rows.map((r) => (
          <span key={r.y} aria-hidden className="flex items-center text-[11px] text-neutral-500" style={{ gridColumn: 1, gridRow: r.y + 1 }}>
            {r.label}
          </span>
        ))}
        {seats.map((s) => (
          <span
            key={s.id}
            title={s.tooltip}
            aria-label={s.tooltip}
            style={{ gridColumn: s.x + 2, gridRow: s.y + 1 }}
            className={`flex items-center justify-center rounded-t-md rounded-b-sm ${SEAT_COLOR[s.state]}`}
          >
            {s.isWheelchair && <Icon name="wheelchair" className="h-3 w-3" />}
          </span>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-neutral-400">
      <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-marquee-500" /> Sold</li>
      <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm ring-2 ring-inset ring-marquee-400" /> Held in checkout</li>
      <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-neutral-700" /> Available</li>
      <li className="text-neutral-500">Hover a seat to see who booked it</li>
    </ul>
  );
}

function BookingsTable({
  bookings,
  canManage,
}: {
  bookings: NonNullable<DashboardVM["showing"]>["bookings"];
  canManage: boolean;
}) {
  return (
    <section aria-labelledby="bookings-title" className="min-w-0">
      <h2 id="bookings-title" className="mb-3 text-lg font-semibold text-white">
        Bookings <span className="text-neutral-500">({bookings.length})</span>
      </h2>
      {bookings.length === 0 ? (
        <p className="rounded-xl bg-white/[0.03] px-4 py-8 text-center text-sm text-neutral-400">No bookings yet.</p>
      ) : (
        <div className="max-h-[36rem] overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-neutral-900 text-xs uppercase tracking-wider text-neutral-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Booker</th>
                <th scope="col" className="px-4 py-3 font-medium">Seats</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                <th scope="col" className="px-4 py-3 font-medium">Ref</th>
                {canManage && (
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bookings.map((b) => (
                <tr key={b.id} className="align-top hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{b.customerName}</p>
                    <p className="text-neutral-400">{b.email}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{b.bookedAt}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{b.seats}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-200">{b.total}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">{b.reference}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {b.modifyHref && (
                          <Link
                            href={b.modifyHref}
                            className={`rounded-md px-2 py-1 text-xs font-medium text-marquee-400 transition hover:bg-marquee-500/10 ${focusRing}`}
                          >
                            Modify
                          </Link>
                        )}
                        <CancelBookingButton bookingId={b.id} reference={b.reference} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
