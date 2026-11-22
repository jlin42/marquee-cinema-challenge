import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

// Reuse one pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { pool?: Pool };

// On Vercel every running instance has its own pool, so keep each one small and let idle
// connections go quickly; Neon's pooled endpoint (PgBouncer) multiplexes them.
const isProduction = process.env.NODE_ENV === "production";

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: isProduction ? 3 : 10,
    idleTimeoutMillis: isProduction ? 10_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle({ client: pool, schema });
export type Db = typeof db;
/** A transaction handle (same query API as `db`). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
