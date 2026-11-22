import { notFound } from "next/navigation";
import { z } from "zod";
import { SiteHeader } from "@/components/layout/site-header";
import { TicketScreen } from "@/features/tickets/ticket-screen";
import { toTicketViewModel } from "@/features/tickets/ticket-view-model";
import { readSessionId } from "@/server/session";
import { getTicket } from "@/server/tickets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your tickets · Marquee Cinemas", robots: { index: false } };

/**
 * Confirmation / ticket page. Only the browser that made the booking can open it (its
 * session cookie must own the booking's hold); anyone else gets a 404. Production would
 * also email a signed link so tickets can be opened on another device.
 */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ticket = await getTicket(id.data, await readSessionId());
  if (!ticket) notFound();

  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <TicketScreen vm={toTicketViewModel(ticket)} />
    </>
  );
}
