import { Pool } from "pg";
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
