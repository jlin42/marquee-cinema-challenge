import { z } from "zod";
import { confirmHold } from "@/server/booking";
import { handle, parseBody, Uuid } from "@/server/http";
import { getOrCreateSessionId } from "@/server/session";

const Body = z.object({ email: z.email().max(254) });

/**
 * POST /api/holds/:id/confirm — turn a hold into a booking (payment is mocked).
 * Idempotent: repeating it returns the same booking. 201, or 410 if the hold expired.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const holdId = Uuid.parse((await ctx.params).id);
  const { email } = await parseBody(req, Body);
  const sessionId = await getOrCreateSessionId();
  const booking = await confirmHold({ holdId, sessionId, email: email.toLowerCase() });
  return Response.json({ booking }, { status: 201 });
});
