// Checks a running Questling against its real database and bot: signs in the way Telegram does
// (sign-in data signed with the bot's token from .env.local), plays a few actions, reads the state
// back, then deletes the test student. Run against a local `next start` with .env.local, or a deployment:
//
//   node scripts/live-check.mjs [http://localhost:3100]
//
// The test student is a made-up Telegram id (999 000 000 + random), never a real person.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const base = process.argv[2] ?? "http://localhost:3100";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);

const telegramId = 999_000_000 + Math.floor(Math.random() * 999_999);
function initData() {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: "Live check", username: "questling_live_check", language_code: "ru" }),
  });
  const check = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(env.TELEGRAM_BOT_TOKEN).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) failures++;
};
const call = async (method, path, body, token) => {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

const db = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  const tampered = new URLSearchParams(initData());
  tampered.set("auth_date", String(Number(tampered.get("auth_date")) - 1));
  const forged = await call("POST", "session", { initData: tampered.toString() });
  check(forged.status === 401, "sign-in data altered after signing is refused");

  const session = await call("POST", "session", { initData: initData() });
  check(session.status === 200 && typeof session.data.token === "string", "sign-in with Telegram-signed data gives a session");
  check(session.data.account?.telegram?.id === telegramId, "the session belongs to the signed Telegram account");
  const token = session.data.token;

  const unauth = await call("GET", "state");
  check(unauth.status === 401, "state without a session is refused");

  const chosen = await call("POST", "actions", { action: { type: "chooseCharacter", characterId: "owl" }, locale: "ru" }, token);
  check(chosen.status === 200 && chosen.data.facts?.profile?.characterId === "owl", "choosing a hero is stored");
  check(chosen.data.facts?.inventory?.length === 3, "the starting kit is handed out");

  const claimTooEarly = await call("POST", "actions", { action: { type: "claimDaily" } }, token);
  check(claimTooEarly.status === 409 && claimTooEarly.data.error === "not_ready", "the day's reward is refused before its quiz");

  const quiz = await call("POST", "actions", { action: { type: "answerDailyQuiz", option: "a" } }, token);
  check(quiz.status === 200 && quiz.data.outcome?.kind === "graded", "the day's quiz is graded on the server");
  const claim = await call("POST", "actions", { action: { type: "claimDaily" } }, token);
  check(claim.status === 200, "the day's reward is claimed");
  const again = await call("POST", "actions", { action: { type: "claimDaily" } }, token);
  check(again.status === 409 && again.data.error === "already_done", "and only once");

  const poor = await call("POST", "actions", { action: { type: "buy", itemId: "ghost" } }, token);
  check(poor.status === 409, "an item out of reach is not sold");

  // Gate 3: the story is a run kept on the server; a wrong answer uses an attempt there.
  const story = (move) => call("POST", "actions", { action: { type: "story", campaign: "forgotten-academy", move }, locale: "ru" }, token);
  const read = await story({ type: "advance", scene: "p-arrive" });
  check(read.status === 200 && read.data.facts?.runs?.[0]?.scene === "p-greet", "the story starts a run and moves on");
  const skipped = await story({ type: "answer", scene: "prologue-1", answer: "whisper" });
  check(skipped.status === 409 && skipped.data.error === "not_available", "a scene ahead of the run is refused");
  await story({ type: "advance", scene: "p-greet" });
  const wrong = await story({ type: "answer", scene: "prologue-1", answer: "eat" });
  check(wrong.status === 200 && wrong.data.outcome?.answer?.correct === false, "a wrong story answer is graded on the server");
  const locked = await call(
    "POST",
    "actions",
    { action: { type: "story", campaign: "echo-tower", move: { type: "advance", scene: "e-bell" } } },
    token,
  );
  check(locked.status === 409, "the second campaign is locked");

  const state = await call("GET", "state", undefined, token);
  const xp = state.data.facts?.ledger?.filter((e) => e.currency === "xp").reduce((s, e) => s + e.amount, 0);
  check(state.status === 200 && xp >= 25, `the record is read back from the database (XP ${xp})`);

  const rows = await db.query(
    "select count(*)::int as n from questling.ledger l join questling.auth_identities a on a.user_id = l.user_id where a.subject = $1",
    [String(telegramId)],
  );
  check(rows.rows[0].n >= 1, "the ledger rows are in Supabase");
  const runs = await db.query(
    "select r.scene, r.used from (select state->>'scene' as scene, (state->'progress'->'prologue-1'->>'used')::int as used, user_id from questling.story_runs) r join questling.auth_identities a on a.user_id = r.user_id where a.subject = $1",
    [String(telegramId)],
  );
  check(runs.rows[0]?.scene === "prologue-1" && runs.rows[0]?.used === 1, "the story run is kept in Supabase, attempt and all");
} finally {
  // Remove the test student and everything of theirs.
  const removed = await db.query(
    "delete from questling.users where id in (select user_id from questling.auth_identities where provider = 'telegram' and subject = $1)",
    [String(telegramId)],
  );
  console.log(`cleaned up ${removed.rowCount} test student`);
  await db.end();
}
process.exit(failures ? 1 : 0);
