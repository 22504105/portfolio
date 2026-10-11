import { Pool, type PoolClient } from "pg";
import { getServerEnv } from "./env";

// The server's own connection to PostgreSQL. It connects as the database
// owner, which row level security does not apply to: everything reached
// through it is server code that has already decided what the caller may do.
// The browser never talks to the database for bookings.

// One pool per process, kept across hot reloads in development.
const holder = globalThis as { cutcoPool?: Pool };

export function db(): Pool {
  if (holder.cutcoPool) return holder.cutcoPool;

  const { DATABASE_URL, DATABASE_CA_CERT } = getServerEnv();
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);

  holder.cutcoPool = new Pool({
    connectionString: DATABASE_URL,
    // Serverless functions come and go: keep few connections and let them idle out.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Encrypted outside the machine. The certificate is verified when a CA is supplied.
    ssl: local ? false : DATABASE_CA_CERT ? { ca: DATABASE_CA_CERT, rejectUnauthorized: true } : { rejectUnauthorized: false },
  });
  return holder.cutcoPool;
}

/** Closes the pool. For scripts and tests that need the process to end. */
export async function closeDb(): Promise<void> {
  await holder.cutcoPool?.end();
  holder.cutcoPool = undefined;
}

/**
 * Runs queries as a signed-in user would see the database: under the
 * `authenticated` role with the user's id in the JWT claims, so row level
 * security applies on top of whatever the code itself checks. For reads on
 * behalf of a client or a barber. Everything happens in one transaction.
 */
export async function asUser<T>(userId: string, run: (query: PoolClient["query"]) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true), set_config('role', 'authenticated', true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    const result = await run(client.query.bind(client) as PoolClient["query"]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
