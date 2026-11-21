import { z } from "zod";
import { confirmHold } from "@/server/booking";
import { handle, parseBody, Uuid } from "@/server/http";
import { TICKET_TYPE_CODES } from "@/server/pricing";
import { getOrCreateSessionId } from "@/server/session";

const Body = z.object({
  email: z.email().max(254),
  /** seat id → ticket type; seats left out are General. Prices are set by the server. */
  tickets: z.record(Uuid, z.enum(TICKET_TYPE_CODES)).optional(),
});

/**
 * POST /api/holds/:id/confirm — turn a hold into a booking (payment is mocked).
 * Idempotent: repeating it returns the same booking. 201, or 410 if the hold expired.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const holdId = Uuid.parse((await ctx.params).id);
  const { email, tickets } = await parseBody(req, Body);
  const sessionId = await getOrCreateSessionId();
  const booking = await confirmHold({ holdId, sessionId, email: email.toLowerCase(), tickets });
  return Response.json({ booking }, { status: 201 });
});
