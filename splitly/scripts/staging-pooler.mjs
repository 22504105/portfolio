// A Supabase database given by its direct address (db.<ref>.supabase.co) answers over IPv6 only, which neither this
// machine nor Vercel's functions use. The same database is reachable over IPv4 through Supabase's pooler, in the
// project's region, with the same password. This finds which region's pooler knows the project and writes that
// address to .env.staging.pooler (never to git, never to Vercel's upload). It prints no secret.
//
//   node scripts/staging-pooler.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const line = (existsSync(".env.staging") ? readFileSync(".env.staging", "utf8") : "")
  .split(/\r?\n/)
  .find((entry) => entry.startsWith("DATABASE_URL="));
const direct = new URL(
  (line ?? "")
    .slice("DATABASE_URL=".length)
    .trim()
    .replace(/^["']|["']$/g, ""),
);
const ref = direct.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1];
if (!ref) {
  console.log("not a direct Supabase address: nothing to do");
  process.exit(0);
}
if (ref === "ayehizzmvwpplwdhcrvn") {
  console.error("this is the PRODUCTION database: refusing");
  process.exit(1);
}

const REGIONS = [
  "eu-west-1",
  "eu-central-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "eu-central-2",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-south-1",
  "sa-east-1",
  "ca-central-1",
];

for (const region of REGIONS) {
  for (const prefix of ["aws-0", "aws-1"]) {
    const url = new URL(direct.href);
    url.hostname = `${prefix}-${region}.pooler.supabase.com`;
    url.port = "6543";
    url.username = `postgres.${ref}`;
    const db = new pg.Client({ connectionString: url.href, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
      await db.connect();
      await db.query("select 1");
      await db.end();
      writeFileSync(
        ".env.staging.pooler",
        `# Found by scripts/staging-pooler.mjs: the same database as .env.staging, over IPv4.\nDATABASE_URL=${url.href}\n`,
      );
      console.log(`found: ${url.hostname}:6543 (written to .env.staging.pooler)`);
      process.exit(0);
    } catch (error) {
      await db.end().catch(() => {});
      const message = String(error.message ?? error);
      // Known to this pooler, but the password is wrong: say so rather than go on looking.
      if (/password authentication failed/i.test(message)) {
        console.error(`the project is in ${region}, but the password in .env.staging is not accepted`);
        process.exit(1);
      }
    }
  }
}
console.error("no pooler knows this project: copy the 'Transaction pooler' address from Supabase's Connect screen into .env.staging");
process.exit(1);
