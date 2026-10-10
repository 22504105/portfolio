// A local PostgreSQL for development, with no Docker and no account anywhere.
// Usage: npm run db:dev   (leave it running; Ctrl+C stops it)
//
// The first run creates the database in .tmp/dev-db, applies the migrations
// and the seed, and writes .env.local if there is none. Later runs start the
// same database again with its data. `npm run db:dev -- --reset` starts over.
//
// It is a plain PostgreSQL with the few things Supabase adds that the
// migrations rely on (tests/db/supabase-shim.sql). Supabase Auth is not part
// of it: sign-in needs a real Supabase project.

import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = 54329;
const DATABASE = "cutco";
const dataDir = path.resolve(".tmp/dev-db");
const url = `postgres://postgres:postgres@127.0.0.1:${PORT}/${DATABASE}`;

if (process.argv.includes("--reset")) rmSync(dataDir, { recursive: true, force: true });
const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  onLog: () => {},
  onError: () => {},
});

if (fresh) await postgres.initialise();
await postgres.start();

if (fresh) {
  await postgres.createDatabase(DATABASE);
  const client = postgres.getPgClient(DATABASE);
  await client.connect();
  await client.query(readFileSync("tests/db/supabase-shim.sql", "utf8"));
  for (const file of readdirSync("supabase/migrations").sort()) {
    await client.query(readFileSync(path.join("supabase/migrations", file), "utf8"));
    console.log(`applied ${file}`);
  }
  await client.query(readFileSync("supabase/seed.sql", "utf8"));
  console.log("seeded");
  await client.end();
}

if (!existsSync(".env.local")) {
  const secret = () => randomBytes(32).toString("base64url");
  writeFileSync(
    ".env.local",
    [
      "# Written by `npm run db:dev` for local development. Not committed.",
      `DATABASE_URL=${url}`,
      "APP_URL=http://localhost:3000",
      `SESSION_SECRET=${secret()}`,
      `CRON_SECRET=${secret()}`,
      "",
    ].join("\n"),
  );
  console.log("wrote .env.local");
}

console.log(`\nPostgreSQL is running: ${url}`);
console.log("Emails are not sent in development: read them at http://localhost:3000/en/dev/mail");
console.log("Ctrl+C to stop.\n");

const stop = async () => {
  await postgres.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// Keeps the process alive while the database runs.
setInterval(() => {}, 60_000);
