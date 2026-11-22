/**
 * Penalty box for the booking endpoints (hold, confirm, discount check).
 *
 * Counts requests per client IP in one-minute windows. A client far beyond what a real
 * person needs (BLOCK_AFTER per minute) is blocked for BASE_BLOCK_MINUTES; each repeat
 * offence doubles the block, up to MAX_BLOCK_MINUTES. Lives in Postgres so it works
 * across every serverless instance.
 *
 * It sits behind the Vercel Firewall rule (which challenges heavy traffic first) and in
 * front of the per-visitor hold limit and the database's no-double-sale rules.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { TooManyRequestsError } from "./errors";

export type AbusePolicy = {
  BLOCK_AFTER: number;
  BASE_BLOCK_MINUTES: number;
  MAX_BLOCK_MINUTES: number;
  STRIKE_MEMORY_HOURS: number;
};

export const ABUSE_POLICY: AbusePolicy = {
  /** Booking requests per IP per minute before a block (a real checkout uses a handful). */
  BLOCK_AFTER: 60,
  BASE_BLOCK_MINUTES: 5,
  MAX_BLOCK_MINUTES: 60,
  /** Strikes are forgiven after this long without a block. */
  STRIKE_MEMORY_HOURS: 24,
};

/**
 * The caller's IP. On Vercel, x-real-ip / the first x-forwarded-for entry are set by
 * the platform; locally there's no proxy, so every request counts as "local".
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

/** Throws TooManyRequestsError if this client is blocked or just crossed the limit. */
export async function guardBookingRequest(req: Request, policy: AbusePolicy = ABUSE_POLICY): Promise<void> {
  const ip = clientIp(req);

  // Already in the penalty box?
  const blocked = await db.execute<{ seconds: number }>(sql`
    SELECT ceil(extract(epoch FROM blocked_until - now()))::int AS seconds
      FROM ip_blocks WHERE ip = ${ip} AND blocked_until > now()
  `);
  if (blocked.rows[0]) throw new TooManyRequestsError(blocked.rows[0].seconds);

  // Count this request in the current one-minute window (atomic upsert).
  const counted = await db.execute<{ count: number }>(sql`
    INSERT INTO request_counters (key, window_start, count)
    VALUES (${ip}, date_bin('1 minute', now(), timestamptz '2000-01-01'), 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = request_counters.count + 1
    RETURNING count
  `);
  const count = counted.rows[0]?.count ?? 0;

  // Occasionally prune old windows (cheap, and no background job needed).
  if (Math.random() < 0.01) {
    await db.execute(sql`DELETE FROM request_counters WHERE window_start < now() - interval '10 minutes'`);
  }

  if (count <= policy.BLOCK_AFTER) return;

  // Over the limit: block, doubling the length for repeat offenders.
  const block = await db.execute<{ seconds: number }>(sql`
    INSERT INTO ip_blocks (ip, blocked_until, strikes, last_blocked_at)
    VALUES (${ip}, now() + make_interval(mins => ${policy.BASE_BLOCK_MINUTES}::int), 1, now())
    ON CONFLICT (ip) DO UPDATE SET
      strikes = CASE
        WHEN ip_blocks.last_blocked_at < now() - make_interval(hours => ${policy.STRIKE_MEMORY_HOURS}::int) THEN 1
        ELSE ip_blocks.strikes + 1
      END,
      blocked_until = now() + make_interval(mins => LEAST(
        ${policy.MAX_BLOCK_MINUTES}::int,
        ${policy.BASE_BLOCK_MINUTES}::int * power(2, CASE
          WHEN ip_blocks.last_blocked_at < now() - make_interval(hours => ${policy.STRIKE_MEMORY_HOURS}::int) THEN 0
          ELSE ip_blocks.strikes
        END)::int
      )),
      last_blocked_at = now()
    RETURNING ceil(extract(epoch FROM blocked_until - now()))::int AS seconds
  `);
  console.warn(`[abuse] blocked ${ip} after ${count} booking requests in a minute`);
  throw new TooManyRequestsError(block.rows[0]?.seconds ?? policy.BASE_BLOCK_MINUTES * 60);
}
