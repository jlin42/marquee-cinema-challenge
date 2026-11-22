/**
 * The booking penalty box: a client far over the limit is blocked for a while, and
 * repeat offenders are blocked for longer. Uses a real Postgres (each test its own IP).
 */
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { ipBlocks, requestCounters } from "@/db/schema";
import { ABUSE_POLICY, clientIp, guardBookingRequest } from "@/server/abuse";
import { TooManyRequestsError } from "@/server/errors";

const ips: string[] = [];
const newIp = () => {
  const ip = `test-${randomUUID()}`;
  ips.push(ip);
  return ip;
};
const requestFrom = (ip: string) => new Request("http://localhost/api/holds", { method: "POST", headers: { "x-real-ip": ip } });
const policy = { ...ABUSE_POLICY, BLOCK_AFTER: 3 };

afterAll(async () => {
  if (ips.length) {
    await db.delete(requestCounters).where(inArray(requestCounters.key, ips));
    await db.delete(ipBlocks).where(inArray(ipBlocks.ip, ips));
  }
  await pool.end();
});

describe("booking penalty box", () => {
  it("reads the client IP from the platform headers", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } }))).toBe("203.0.113.9");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });

  it("lets normal use through, then blocks a client that goes over the limit", async () => {
    const ip = newIp();
    for (let i = 0; i < policy.BLOCK_AFTER; i++) await guardBookingRequest(requestFrom(ip), policy);

    const over = guardBookingRequest(requestFrom(ip), policy);
    await expect(over).rejects.toBeInstanceOf(TooManyRequestsError);
    const err = (await over.catch((e) => e)) as TooManyRequestsError;
    expect(err.retryAfterSeconds).toBeGreaterThan(4 * 60);
    expect(err.retryAfterSeconds).toBeLessThanOrEqual(5 * 60);

    // Still blocked on the next request, even though it's a new attempt.
    await expect(guardBookingRequest(requestFrom(ip), policy)).rejects.toBeInstanceOf(TooManyRequestsError);
  });

  it("doubles the block for a repeat offender", async () => {
    const ip = newIp();
    for (let i = 0; i <= policy.BLOCK_AFTER; i++) await guardBookingRequest(requestFrom(ip), policy).catch(() => {});

    // Serve the first block, start a fresh window, and offend again.
    await db.execute(sql`UPDATE ip_blocks SET blocked_until = now() - interval '1 second' WHERE ip = ${ip}`);
    await db.execute(sql`DELETE FROM request_counters WHERE key = ${ip}`);
    for (let i = 0; i < policy.BLOCK_AFTER; i++) await guardBookingRequest(requestFrom(ip), policy);
    const err = (await guardBookingRequest(requestFrom(ip), policy).catch((e) => e)) as TooManyRequestsError;

    expect(err).toBeInstanceOf(TooManyRequestsError);
    expect(err.retryAfterSeconds).toBeGreaterThan(9 * 60); // 10 minutes the second time
  });

  it("counts concurrent requests exactly (no lost updates under a burst)", async () => {
    const ip = newIp();
    const burst = await Promise.allSettled(Array.from({ length: 10 }, () => guardBookingRequest(requestFrom(ip), policy)));
    expect(burst.filter((r) => r.status === "fulfilled")).toHaveLength(policy.BLOCK_AFTER);
  });
});
