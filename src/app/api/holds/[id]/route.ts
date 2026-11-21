import { releaseHold } from "@/server/booking";
import { handle, Uuid } from "@/server/http";
import { getOrCreateSessionId } from "@/server/session";

/** DELETE /api/holds/:id — release a hold early. 204. */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const holdId = Uuid.parse((await ctx.params).id);
  const sessionId = await getOrCreateSessionId();
  await releaseHold({ holdId, sessionId });
  return new Response(null, { status: 204 });
});
