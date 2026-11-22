import { z } from "zod";
import { checkDiscount, DiscountCodeInput } from "@/server/discounts";
import { handle, parseBody } from "@/server/http";

const Body = z.object({ code: DiscountCodeInput });

/**
 * POST /api/discounts/check: preview what a code takes off (200), or 422 if it isn't
 * valid. Only a preview: the booking applies the code again, inside its transaction.
 * Production: rate-limit this per IP/session so codes can't be guessed by brute force.
 */
export const POST = handle(async (req: Request) => {
  const { code } = await parseBody(req, Body);
  return Response.json({ discount: await checkDiscount(code) });
});
