import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { locations } from "@/db/schema";

export const LOCATION_COOKIE = "marquee_location";

export type Location = { id: string; name: string; city: string };

export async function listLocations(): Promise<Location[]> {
  return db
    .select({ id: locations.id, name: locations.name, city: locations.city })
    .from(locations)
    .orderBy(asc(locations.name));
}

/** True if a theater with this id exists. */
export async function locationExists(id: string): Promise<boolean> {
  const [row] = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, id)).limit(1);
  return Boolean(row);
}

/** The visitor's chosen theater (from a cookie), falling back to the first one. */
export async function getSelectedLocation(all: Location[]): Promise<Location | null> {
  const saved = (await cookies()).get(LOCATION_COOKIE)?.value;
  return all.find((l) => l.id === saved) ?? all[0] ?? null;
}
