import { z } from "zod";
import { confirmHold } from "@/server/booking";
import { DiscountCodeInput } from "@/server/discounts";
import { handle, parseBody, Uuid } from "@/server/http";
import { TICKET_TYPE_CODES } from "@/server/pricing";
import { getOrCreateSessionId } from "@/server/session";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  /** seat id → ticket type; seats left out are General. Prices are set by the server. */
  tickets: z.record(Uuid, z.enum(TICKET_TYPE_CODES)).optional(),
  /** Optional discount code; validated and counted inside the booking transaction. */
  discountCode: DiscountCodeInput.optional(),
  // No card details: in production the payment provider's own fields collect them and
  // we'd receive only a payment token here. This demo's payment is mocked in the browser.
});

/**
 * POST /api/holds/:id/confirm — turn a hold into a booking (payment is mocked).
 * Idempotent: repeating it returns the same booking. 201, or 410 if the hold expired.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const holdId = Uuid.parse((await ctx.params).id);
  const { name, email, tickets, discountCode } = await parseBody(req, Body);
  const sessionId = await getOrCreateSessionId();
  const booking = await confirmHold({ holdId, sessionId, customerName: name, email: email.toLowerCase(), tickets, discountCode });
  return Response.json({ booking }, { status: 201 });
});
