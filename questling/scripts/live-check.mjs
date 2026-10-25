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
// The studio part's teacher: a throwaway Supabase account, removed at the end.
const teacherAuthId = crypto.randomUUID();
const teacherEmail = `live-check-${telegramId}@questling.invalid`;
const teacherPassword = `Live-${crypto.randomUUID()}`;
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

  // ——— Teacher Studio (Gate 4) ———
  // Supabase refuses made-up addresses at sign-up, so the check's teacher is a confirmed Supabase
  // account written straight into the auth schema; it signs in through the app's own endpoint.
  await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
       raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')),
       now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Live check teacher"}', now(), now(), '', '', '', '')`,
    [teacherAuthId, teacherEmail, teacherPassword],
  );
  await db.query(
    `insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     values (gen_random_uuid(), $1::uuid, $1::text, jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true), 'email', now(), now(), now())`,
    [teacherAuthId, teacherEmail],
  );
  const wrongPassword = await call("POST", "studio/signin", { email: teacherEmail, password: "not-the-password" });
  check(wrongPassword.status === 401, "a teacher's wrong password is refused");
  const teacher = await call("POST", "studio/signin", { email: teacherEmail, password: teacherPassword });
  check(teacher.status === 200 && typeof teacher.data.token === "string", "a teacher signs in with email and password");
  const tt = teacher.data.token;
  const studentInStudio = await call("GET", "studio/state", undefined, token);
  check(studentInStudio.status === 403, "a student's session is kept out of the studio");
  const studio = (action) => call("POST", "studio/actions", { action }, tt);

  const group = await studio({ type: "createGroup", name: "Live check A2", cefr: "A2" });
  const groupId = group.data.outcome?.id;
  const code = group.data.facts?.groups?.find((g) => g.id === groupId)?.inviteCode;
  check(group.status === 200 && /^[A-Z0-9]{8}$/.test(code ?? ""), "a teacher creates a group with an invite code");
  const joined = await call("POST", "join", { code: code?.toLowerCase() }, token);
  check(joined.status === 200 && joined.data.account?.group?.name === "Live check A2", "a student joins by the code");
  const roster = await call("GET", "studio/state", undefined, tt);
  check(roster.data.facts?.members?.length === 1, "the teacher sees the student in the group");

  const quest = await studio({ type: "createQuest", title: "Live check quest", cefr: "A2" });
  const questId = quest.data.outcome?.id;
  const published = await studio({ type: "publish", questId });
  const own = published.data.facts?.quests?.find((q) => q.id === questId);
  check(published.status === 200 && own?.versions?.[0]?.status === "published", "a teacher's campaign is published as v1");
  const frozen = await db.query("update questling.quest_versions set note = 'changed' where quest_id = $1 and version = 1", [questId]).then(
    () => null,
    (error) => error.code,
  );
  check(frozen === "55000", "a published version cannot be changed in the database");
  const assigned = await studio({ type: "assign", groupId, campaign: own?.slug, version: 1, dueAt: null });
  check(assigned.status === 200, "the campaign is assigned to the group");
  const world = (await call("GET", "state", undefined, token)).data.facts?.world;
  check(
    world?.campaigns?.some((c) => c.id === own?.slug) && !JSON.stringify(world).includes('"correct"'),
    "the student gets the assigned campaign, without its answer keys",
  );

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const daily = await studio({
    type: "setDaily",
    groupId,
    day: today,
    content: {
      word: { text: "lantern", ipa: "ˈlæntən", translation: { ru: "фонарь", en: "lantern" }, example: "The lantern shines." },
      fact: {
        title: "Lanterns",
        text: "Old lanterns burned oil.",
        explanation: { ru: "Старые фонари жгли масло.", en: "Old lanterns burned oil." },
        source: "Live check",
      },
      quiz: {
        question: "What did old lanterns burn?",
        options: [
          { id: "a", text: "water" },
          { id: "b", text: "oil" },
        ],
        correct: "b",
      },
    },
  });
  check(daily.status === 200, "a teacher plans the group's word of the day");
  const planned = (await call("GET", "state", undefined, token)).data.facts?.world?.daily ?? [];
  check(
    planned.some((d) => d.day === today && d.entry.word.text === "lantern"),
    "the student gets the teacher's word of the day",
  );

  await db.query(
    "insert into questling.completions (user_id, kind, ref, at) select user_id, 'help_request', 'forgotten-academy/tower-2', now() from questling.auth_identities where provider = 'telegram' and subject = $1",
    [String(telegramId)],
  );
  const studentId = roster.data.facts?.members?.[0]?.userId;
  const reply = await studio({ type: "replyHelp", userId: studentId, ref: "forgotten-academy/tower-2", body: "Перечитай свиток." });
  const messages = (await call("GET", "state", undefined, token)).data.facts?.world?.messages ?? [];
  check(reply.status === 200 && messages.some((m) => m.body === "Перечитай свиток."), "the mentor's reply reaches the student");

  // Gate 5: the student's own data — downloaded through a ticket link, then deleted through the API.
  const ticket = await call("POST", "export/ticket", {}, token);
  const file = ticket.data.url ? await fetch(`${base}${ticket.data.url}`) : null;
  const exported = file ? await file.json().catch(() => ({})) : {};
  check(
    file?.status === 200 && exported.identities?.[0]?.subject === String(telegramId) && exported.ledger?.length > 0,
    "the student downloads their data through a ticket link",
  );
  check((await call("GET", "state", undefined, ticket.data.url?.split("ticket=")[1])).status === 401, "the ticket is not a session");
  const deleted = await call("POST", "account/delete", { confirm: "delete" }, token);
  const left = await db.query("select count(*)::int as n from questling.auth_identities where provider = 'telegram' and subject = $1", [
    String(telegramId),
  ]);
  check(deleted.status === 200 && left.rows[0].n === 0, "the student deletes their data, and nothing of it is left");
} finally {
  // Remove the test student and everything of theirs.
  const removed = await db.query(
    "delete from questling.users where id in (select user_id from questling.auth_identities where provider = 'telegram' and subject = $1)",
    [String(telegramId)],
  );
  console.log(`cleaned up ${removed.rowCount} test student`);
  // And the check's teacher: their groups, quests and replies go with their user; then the auth account.
  const teacherRemoved = await db.query(
    "delete from questling.users where id in (select user_id from questling.auth_identities where provider = 'supabase' and subject = $1)",
    [teacherAuthId],
  );
  await db.query("delete from auth.users where id = $1", [teacherAuthId]);
  console.log(`cleaned up ${teacherRemoved.rowCount} test teacher`);
  await db.end();
}
process.exit(failures ? 1 : 0);
