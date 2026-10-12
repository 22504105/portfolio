import "server-only";
import { Pool, type PoolClient } from "pg";

// The one way the server reaches the database. Every table is named with its
// schema (splitly.…): the connection goes through a pooler that shares
// sessions between requests, so nothing may depend on session settings.

let pool: Pool | undefined;

export function serverEnv() {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    sessionSecret: process.env.SESSION_SECRET ?? "",
  };
}

/** Whether accounts can work at all here: a database, a bot to verify sign-ins against, a secret to sign sessions with. */
export function accountsConfigured(): boolean {
  const env = serverEnv();
  return env.databaseUrl !== "" && env.botToken !== "" && env.sessionSecret.length >= 32;
}

function getPool(): Pool {
  if (!pool) {
    const { databaseUrl } = serverEnv();
    if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl);
    pool = new Pool({
      connectionString: databaseUrl,
      // Few connections: each serverless instance has its own pool, and the database's pooler does the real sharing.
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: local ? false : { rejectUnauthorized: false },
    });
    // A dropped idle connection must not take the process down with it.
    pool.on("error", () => {});
  }
  return pool;
}

export type Db = Pick<PoolClient, "query">;

/**
 * Runs everything in one transaction: all of it is stored, or none of it.
 * The deferred balance checks of the schema run at the commit, so an
 * expense that does not add up fails here, whole.
 */
export async function transaction<T>(run: (db: Db) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * One statement on its own, outside any transaction: stored at once, and it
 * stays stored whatever happens to the request afterwards. Counting attempts
 * needs exactly that: a refused attempt must still have been counted.
 */
export const standalone: Db = { query: ((...args: Parameters<Pool["query"]>) => getPool().query(...args)) as Db["query"] };

/** For tests: point the server at another database, or close the pool. */
export async function resetPool(): Promise<void> {
  const current = pool;
  pool = undefined;
  await current?.end().catch(() => {});
}
