import { z } from "zod";
import { createHold, MAX_SEATS_PER_HOLD, releaseHold } from "@/server/booking";
import { handle, parseBody, Uuid } from "@/server/http";
import { getOrCreateSessionId } from "@/server/session";
import { getActiveHold } from "@/server/showings";

const Body = z.object({
  showingId: Uuid,
  seatIds: z.array(Uuid).min(1).max(MAX_SEATS_PER_HOLD),
});

/** POST /api/holds — hold seats for this browser session. 201, or 409 with the conflicting seatIds. */
export const POST = handle(async (req: Request) => {
  const { showingId, seatIds } = await parseBody(req, Body);
  const sessionId = await getOrCreateSessionId();

  // One hold per session per showing: changing seats replaces the previous hold.
  const previous = await getActiveHold(showingId, sessionId);
  if (previous) await releaseHold({ holdId: previous.id, sessionId });

  const hold = await createHold({ showingId, seatIds, sessionId });
  return Response.json({ hold }, { status: 201 });
});
