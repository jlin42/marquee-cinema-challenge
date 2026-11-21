import { notFound } from "next/navigation";
import { z } from "zod";
import { SiteHeader } from "@/components/layout/site-header";
import { BookingScreen } from "@/features/booking/booking-screen";
import { getBookingViewModel } from "@/features/booking/booking-view-model";

export const dynamic = "force-dynamic"; // live seat states
export const metadata = { title: "Choose seats · Marquee Cinemas" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ShowingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; confirmed?: string }>;
}) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const { date, confirmed } = await searchParams;

  const vm = await getBookingViewModel(parsed.data, {
    date: date && DATE.test(date) ? date : undefined,
    theaterConfirmed: confirmed === "1",
  });
  if (!vm) notFound();

  return (
    <>
      {/* The theater is fixed once you're booking a showing: no picker here. */}
      <SiteHeader showLocationPicker={false} />
      {/* Keyed by showing: switching showtimes starts a fresh selection. */}
      <BookingScreen key={vm.showingId} vm={vm} />
    </>
  );
}

