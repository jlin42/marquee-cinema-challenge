/**
 * Discount codes. The client can check a code to preview the price, but the discount is
 * only ever applied by confirmHold, inside the booking transaction, from this table.
 * Every failure gives the same answer, so a lookup doesn't reveal why a code was refused.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { discountCodes } from "@/db/schema";
import { InvalidDiscountError } from "./errors";

type Conn = Pick<typeof db, "select">;
export type DiscountCode = typeof discountCodes.$inferSelect;

/** Accepts what people type ("  comp-100 ") and stores/looks up "COMP-100". */
export const DiscountCodeInput = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((s) => s.toUpperCase());

function isUsable(d: DiscountCode | undefined, now: Date): d is DiscountCode {
  if (!d || !d.isActive) return false;
  if (d.expiresAt && d.expiresAt <= now) return false;
  if (d.maxRedemptions != null && d.redemptions >= d.maxRedemptions) return false;
  return true;
}

/** Look up a usable code; `lock` takes a row lock (use inside the booking transaction). */
export async function findUsableDiscount(conn: Conn, code: string, options: { lock?: boolean } = {}): Promise<DiscountCode> {
  const query = conn.select().from(discountCodes).where(eq(discountCodes.code, code));
  const [row] = options.lock ? await query.for("update") : await query;
  if (!isUsable(row, new Date())) throw new InvalidDiscountError();
  return row;
}

/** Public preview: what a code would take off. */
export async function checkDiscount(code: string) {
  const d = await findUsableDiscount(db, code);
  return { code: d.code, description: d.description, percentOff: d.percentOff };
}
