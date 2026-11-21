"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { locations } from "@/db/schema";
import { LOCATION_COOKIE } from "@/server/locations";

/** Remember the visitor's theater. Not sensitive: a preference, not an identity. */
export async function selectLocation(locationId: string) {
  const id = z.uuid().parse(locationId);
  const [exists] = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, id));
  if (!exists) return;

  (await cookies()).set(LOCATION_COOKIE, id, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
