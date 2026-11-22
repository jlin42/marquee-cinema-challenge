/**
 * Break-glass admin reset: `npm run staff:reset-admin`.
 *
 * Makes the account in STAFF_ADMIN_USERNAME / STAFF_ADMIN_PASSWORD (.env) exist, be an
 * active admin with that password, and not be locked out. Touches nothing else, and
 * prints what it found, so it doubles as a diagnostic when sign-in fails.
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./client";
import { staffSessions, staffUsers } from "./schema";
import { hashPassword } from "../server/passwords";

async function main() {
  const username = process.env.STAFF_ADMIN_USERNAME?.trim();
  const password = process.env.STAFF_ADMIN_PASSWORD;
  if (!username || !password) {
    console.error("Set STAFF_ADMIN_USERNAME and STAFF_ADMIN_PASSWORD in .env first.");
    process.exitCode = 1;
    return;
  }

  const [total] = (await db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM staff_users`)).rows;
  console.log(`Staff accounts in the database: ${total?.n ?? 0}`);

  const [existing] = await db
    .select()
    .from(staffUsers)
    .where(sql`lower(${staffUsers.username}) = lower(${username})`);

  const passwordHash = await hashPassword(password);
  if (!existing) {
    await db.insert(staffUsers).values({ username, name: username, passwordHash, role: "admin" });
    console.log(`"${username}" didn't exist. Created it as an active admin with the password from .env.`);
  } else {
    const wasLocked = existing.lockedUntil != null && existing.lockedUntil > new Date();
    console.log(
      `Found "${existing.username}": role ${existing.role}, ${existing.isActive ? "active" : "INACTIVE"}, ` +
        `${existing.failedAttempts} failed attempts${wasLocked ? ", LOCKED OUT" : ""}.`,
    );
    await db
      .update(staffUsers)
      .set({ passwordHash, role: "admin", isActive: true, failedAttempts: 0, lockedUntil: null })
      .where(eq(staffUsers.id, existing.id));
    await db.delete(staffSessions).where(eq(staffSessions.staffUserId, existing.id));
    console.log("Reset it: active admin, password from .env, lockout cleared.");
  }
  console.log(`Sign in at /staff as "${username}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
