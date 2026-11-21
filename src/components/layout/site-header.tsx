import Link from "next/link";
import { focusRing } from "@/components/ui/icon-button";
import { LocationPicker } from "@/features/location/location-picker";
import { MobileMenu } from "@/features/location/mobile-menu";
import { getLocationPickerViewModel } from "@/features/location/location-view-model";

/**
 * Top bar: logo on the left; theater picker and Movies on the right.
 * `overlay` floats it over a full-screen hero; otherwise it's a sticky bar.
 * `showLocationPicker={false}` hides the picker where the theater is fixed (booking).
 * Below the `sm` breakpoint the right side collapses into a menu (MobileMenu).
 */
export async function SiteHeader({
  overlay = false,
  showLocationPicker = true,
}: {
  overlay?: boolean;
  showLocationPicker?: boolean;
}) {
  const picker = showLocationPicker ? await getLocationPickerViewModel() : null;

  return (
    <header
      className={`z-30 w-full ${
        overlay
          ? "absolute inset-x-0 top-0 bg-linear-to-b from-black/70 to-transparent"
          : "sticky top-0 border-b border-white/10 bg-neutral-950/90 backdrop-blur"
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-12 sm:py-5 lg:px-20">
        <Link href="/" className={`shrink-0 font-display text-2xl tracking-[0.15em] text-white sm:text-3xl sm:tracking-[0.2em] ${focusRing}`}>
          Marquee<span className="text-marquee-400">.</span>
        </Link>

        {/* Phones: theater and Movies fold into one menu button. */}
        <MobileMenu picker={picker} />

        <nav aria-label="Main" className="hidden min-w-0 items-center gap-4 sm:flex">
          {picker && <LocationPicker vm={picker} />}
          <Link
            href="/movies"
            className={`shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white ${focusRing}`}
          >
            Movies
          </Link>
        </nav>
      </div>
    </header>
  );
}
