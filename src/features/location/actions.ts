"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCATION_COOKIE, locationExists } from "@/server/locations";

/** Remember the visitor's theater. Not sensitive: a preference, not an identity. */
export async function selectLocation(locationId: string) {
  const id = z.uuid().parse(locationId);
  if (!(await locationExists(id))) return;

  (await cookies()).set(LOCATION_COOKIE, id, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
