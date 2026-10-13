// Reads .env.staging (the trial stand's own bot and database, never production's) and checks it before anything is
// done with it. Prints no secret: only whether each value is there and well-formed, the database's host, and what
// is already in the database. Exits with an error if anything in it is production's.
//
//   node scripts/staging-env.mjs            checks, and says what the database holds
//
// Other scripts import `stagingEnv()` to get the values.
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pg from "pg";

/** The production database: the trial stand must never be pointed at it. */
const PRODUCTION_DATABASE = "ayehizzmvwpplwdhcrvn";

const parse = (file) =>
  Object.fromEntries(
    (existsSync(file) ? readFileSync(file, "utf8") : "")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line
          .slice(line.indexOf("=") + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ]),
  );

export function stagingEnv() {
  const staging = parse(".env.staging");
  const production = parse(".env.local");
  const problems = [];
  // The token alone, even if the line was pasted with its name twice or with spaces around it.
  const token = (staging.TELEGRAM_BOT_TOKEN ?? "").match(/\d{6,12}:[A-Za-z0-9_-]{30,}/)?.[0] ?? "";
  const username = (staging.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "");
  // The address that works from here and from Vercel, if one was found for a database given by its IPv6-only address.
  const databaseUrl = parse(".env.staging.pooler").DATABASE_URL ?? staging.DATABASE_URL ?? "";

  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token)) problems.push("TELEGRAM_BOT_TOKEN is empty or not shaped like a bot token");
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) problems.push("TELEGRAM_BOT_USERNAME is empty or not a bot's name");
  let host = "";
  try {
    const url = new URL(databaseUrl);
    host = url.host;
    if (!/^postgres(ql)?:$/.test(url.protocol)) problems.push("DATABASE_URL is not a postgresql:// address");
    if (!url.password) problems.push("DATABASE_URL has no password in it");
  } catch {
    problems.push("DATABASE_URL is empty or not an address");
  }
  // Nothing of production's may be here, by any of the ways it could have got here.
  if (databaseUrl.includes(PRODUCTION_DATABASE)) problems.push("DATABASE_URL is the PRODUCTION database");
  if (production.DATABASE_URL && production.DATABASE_URL === databaseUrl) problems.push("DATABASE_URL is the same as .env.local's");
  if (production.TELEGRAM_BOT_TOKEN && production.TELEGRAM_BOT_TOKEN === token) problems.push("TELEGRAM_BOT_TOKEN is the PRODUCTION bot's");
  if (production.TELEGRAM_BOT_TOKEN && production.TELEGRAM_BOT_TOKEN.split(":")[0] === token.split(":")[0])
    problems.push("TELEGRAM_BOT_TOKEN belongs to the same bot as production's");
  if (/^splitlly_bot$/i.test(username)) problems.push("TELEGRAM_BOT_USERNAME is the PRODUCTION bot");
  return { token, username, databaseUrl, host, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = stagingEnv();
  console.log(`bot: @${env.username || "?"}   database host: ${env.host || "?"}`);
  if (env.problems.length > 0) {
    for (const problem of env.problems) console.error(`  PROBLEM  ${env.problems.length > 0 ? problem : ""}`);
    process.exit(1);
  }
  console.log("  ok  nothing here is production's");

  // The bot, as Telegram knows it: the token works and is this bot's.
  const me = await fetch(`https://api.telegram.org/bot${env.token}/getMe`).then((response) => response.json());
  if (!me.ok) {
    console.error("  PROBLEM  Telegram does not accept the token");
    process.exit(1);
  }
  console.log(
    `  ok  Telegram knows the bot as @${me.result.username}${me.result.username === env.username ? "" : "  (NOT the name in the file)"}`,
  );

  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(env.databaseUrl);
  const db = new pg.Client({ connectionString: env.databaseUrl, ssl: local ? false : { rejectUnauthorized: false } });
  await db.connect();
  try {
    const { rows } = await db.query(
      `select table_schema as schema, count(*)::int as tables from information_schema.tables
       where table_schema not in ('pg_catalog', 'information_schema') and table_schema not like 'pg_%'
       group by table_schema order by table_schema`,
    );
    const version = (await db.query("show server_version")).rows[0].server_version;
    console.log(`  ok  the database answers (PostgreSQL ${version})`);
    console.log(
      rows.length === 0 ? "  ok  it is empty" : `  it holds: ${rows.map((row) => `${row.schema} (${row.tables} tables)`).join(", ")}`,
    );
    if (rows.some((row) => row.schema === "splitly")) {
      const counts = await db.query(
        "select (select count(*) from splitly.users)::int as users, (select count(*) from splitly.groups)::int as groups, (select count(*) from splitly.expenses)::int as expenses",
      );
      console.log(`  splitly already there: ${JSON.stringify(counts.rows[0])}`);
    }
  } finally {
    await db.end();
  }
}
