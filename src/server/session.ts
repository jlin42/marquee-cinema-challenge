import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Anonymous session for guest checkout. A random, unguessable id in an
 * httpOnly cookie proves which browser owns a hold. No accounts needed.
 */
const COOKIE = "marquee_session";
const MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day

/** Read the session id if the browser has one (for read-only requests). */
export async function readSessionId(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

/** Get the session id, creating the cookie if needed (route handlers only). */
export async function getOrCreateSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return id;
}
