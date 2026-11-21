import { handle, Uuid } from "@/server/http";
import { listUpcomingShowings } from "@/server/showings";

export const dynamic = "force-dynamic";

/** GET /api/showings?locationId=… — upcoming showings with seats left. */
export const GET = handle(async (req: Request) => {
  const raw = new URL(req.url).searchParams.get("locationId");
  const locationId = raw ? Uuid.parse(raw) : undefined;
  const showings = await listUpcomingShowings(locationId);
  return Response.json({ showings });
});
