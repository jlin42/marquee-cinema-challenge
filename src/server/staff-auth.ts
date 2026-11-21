/**
 * Staff authentication.
 *
 * - Passwords: scrypt (Node's built-in, memory-hard) with a random salt per user.
 * - Sessions: a random 256-bit token in an httpOnly cookie; only its SHA-256 hash is
 *   stored, so a database leak doesn't expose usable sessions. Sessions expire.
 * - Brute force: 5 failed attempts lock the account for 15 minutes. Errors never reveal
 *   whether a username exists.
 * - Authorization: roles and permissions come from the trust matrix (permissions.ts).
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { staffSessions, staffUsers } from "@/db/schema";
import { hashPassword, verifyPassword } from "./passwords";
import { can, type Permission, type StaffRole } from "./permissions";

export { hashPassword } from "./passwords";

export const STAFF_COOKIE = "marquee_staff";
const SESSION_HOURS = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// A real hash to verify against when the email is unknown, so timing doesn't reveal accounts.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(16).toString("hex")));

// ---------- Sessions ----------

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type StaffUser = {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
};

export type LoginResult = { ok: true } | { ok: false; error: string };
const GENERIC_ERROR = "That username and password don't match.";

/** Check credentials, apply lockout, and on success start a session (sets the cookie). */
export async function logIn(usernameInput: string, password: string): Promise<LoginResult> {
  const username = usernameInput.trim().toLowerCase();
  const [user] = await db.select().from(staffUsers).where(sql`lower(${staffUsers.username}) = ${username}`);

  if (!user) {
    await verifyPassword(password, await getDummyHash()); // same work as a real check
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!user.isActive) {
    await verifyPassword(password, user.passwordHash); // same timing as any other failure
    return { ok: false, error: GENERIC_ERROR };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const attempts = user.failedAttempts + 1;
    await db
      .update(staffUsers)
      .set({
        failedAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? sql`now() + make_interval(mins => ${LOCKOUT_MINUTES})` : null,
      })
      .where(eq(staffUsers.id, user.id));
    return { ok: false, error: GENERIC_ERROR };
  }

  await db.update(staffUsers).set({ failedAttempts: 0, lockedUntil: null }).where(eq(staffUsers.id, user.id));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await db.insert(staffSessions).values({ tokenHash: hashToken(token), staffUserId: user.id, expiresAt });
  (await cookies()).set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // staff links are never followed from other sites
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

/** The signed-in staff member, or null. */
export async function getCurrentStaff(): Promise<StaffUser | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: staffUsers.id,
      username: staffUsers.username,
      name: staffUsers.name,
      role: staffUsers.role,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffSessions.staffUserId))
    .where(
      and(
        eq(staffSessions.tokenHash, hashToken(token)),
        gt(staffSessions.expiresAt, sql`now()`),
        eq(staffUsers.isActive, true), // deactivation takes effect immediately
      ),
    );
  return row ?? null;
}

/**
 * Use at the top of every staff page and action: sends signed-out visitors to the login,
 * and refuses anyone whose role lacks `permission` (see the trust matrix).
 */
export async function requireStaff(permission: Permission = "dashboard.view"): Promise<StaffUser> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/staff");
  if (!can(staff, permission)) notFound(); // don't reveal pages a role can't use
  return staff;
}

export async function logOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (token) await db.delete(staffSessions).where(eq(staffSessions.tokenHash, hashToken(token)));
  jar.delete(STAFF_COOKIE);
}

/** Sign a staff member out everywhere (used when an admin deactivates or changes their role). */
export async function revokeSessions(staffUserId: string): Promise<void> {
  await db.delete(staffSessions).where(eq(staffSessions.staffUserId, staffUserId));
}
