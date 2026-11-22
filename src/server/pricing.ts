import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { ticketTypes } from "@/db/schema";

export type TicketTypeCode = (typeof ticketTypes.$inferSelect)["code"];
export const TICKET_TYPE_CODES = ["general", "child", "senior"] as const satisfies readonly TicketTypeCode[];
export type TicketType = typeof ticketTypes.$inferSelect;

/** The price list, in display order. */
export async function listTicketTypes(conn: Pick<typeof db, "select"> = db): Promise<TicketType[]> {
  return conn.select().from(ticketTypes).orderBy(asc(ticketTypes.sortOrder));
}

/** Percent off the whole order, rounded to the nearest cent; never below $0. */
export function applyDiscount(subtotalCents: number, percentOff: number) {
  const pct = Math.min(100, Math.max(0, percentOff));
  const discountCents = Math.min(subtotalCents, Math.round((subtotalCents * pct) / 100));
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

export type PricedTicket = { seatId: string; ticketType: TicketTypeCode; priceCents: number; feeCents: number };

/**
 * Price every seat in a hold. Seats without a chosen type are General.
 * Returns null if `tickets` names a seat outside the hold or an unknown type.
 */
export function priceTickets(
  seatIds: string[],
  tickets: Partial<Record<string, TicketTypeCode>>,
  priceList: TicketType[],
): { lines: PricedTicket[]; totalCents: number } | null {
  if (Object.keys(tickets).some((seatId) => !seatIds.includes(seatId))) return null;
  const byCode = new Map(priceList.map((t) => [t.code, t]));

  const lines: PricedTicket[] = [];
  for (const seatId of seatIds) {
    const type = byCode.get(tickets[seatId] ?? "general");
    if (!type) return null;
    lines.push({ seatId, ticketType: type.code, priceCents: type.priceCents, feeCents: type.feeCents });
  }
  return { lines, totalCents: lines.reduce((sum, l) => sum + l.priceCents + l.feeCents, 0) };
}
