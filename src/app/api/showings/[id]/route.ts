import { getSeatMap } from "@/server/booking";
import { errorResponse, handle, Uuid } from "@/server/http";
import { readSessionId } from "@/server/session";
import { getActiveHold, getShowing } from "@/server/showings";

export const dynamic = "force-dynamic";

/** GET /api/showings/:id — showing details, seat map, and the caller's active hold. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = Uuid.parse((await ctx.params).id);
  const showing = await getShowing(id);
  if (!showing) return errorResponse(404, "SHOWING_NOT_FOUND", "Showing not found.");

  const sessionId = await readSessionId();
  const [seats, hold] = await Promise.all([
    getSeatMap(id, sessionId),
    sessionId ? getActiveHold(id, sessionId) : null,
  ]);
  return Response.json({ showing, seats, hold });
});
