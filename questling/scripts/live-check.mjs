// Checks a running Questling against its real database and bot: signs in the way Telegram does
// (sign-in data signed with the bot's token from .env.local), plays a few actions, reads the state
// back, then deletes the test student. Run against a local `next start` with .env.local, or a deployment:
//
//   npx tsx scripts/live-check.mjs [http://localhost:3100]   (tsx: it reads the answer keys from the sources)
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
// A second made-up student, outside the check's group: what must stay closed to them.
const outsiderId = telegramId + 1_000_000;
// The studio part's teacher: a throwaway Supabase account, removed at the end.
const teacherAuthId = crypto.randomUUID();
const teacherEmail = `live-check-${telegramId}@questling.invalid`;
const teacherPassword = `Live-${crypto.randomUUID()}`;
function initData(id = telegramId) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: "Live check", username: "questling_live_check", language_code: "ru" }),
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

  // ——— Word journal (features gate D) ———
  const moscowDay = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  const kept = await call("POST", "actions", { action: { type: "keepWord", ref: `daily:${moscowDay}` } }, token);
  check(kept.status === 200 && kept.data.facts?.vocab?.length === 1, "the day's word is kept in the journal");
  const keptTwice = await call("POST", "actions", { action: { type: "keepWord", ref: `daily:${moscowDay}` } }, token);
  check(keptTwice.status === 409 && keptTwice.data.error === "already_done", "the same word is not kept twice");
  const unreached = await call("POST", "actions", { action: { type: "keepWord", ref: "gloss:forgotten-academy:tower-4:tower-4-2" } }, token);
  check(unreached.status === 409 && unreached.data.error === "not_available", "a word from a scene not reached is refused");
  const notDue = await call("POST", "actions", { action: { type: "reviewWord", ref: `daily:${moscowDay}`, option: "a" } }, token);
  check(notDue.status === 409, "a word is not reviewed (for XP) before it is due");
  const vocabRows = await db.query(
    "select count(*)::int as n from questling.vocab v join questling.auth_identities a on a.user_id = v.user_id where a.subject = $1",
    [String(telegramId)],
  );
  check(vocabRows.rows[0].n === 1, "the journal card is in Supabase");

  const poor = await call("POST", "actions", { action: { type: "buy", itemId: "ghost" } }, token);
  check(poor.status === 409, "an item out of reach is not sold");

  // Today's quick quests, answered right: XP and coins once each, then a real purchase with the coins.
  const { quickQuestKeys } = await import("../lib/content/quick-quest-keys.ts");
  const { dailyQuests } = await import("../lib/game/stats.ts");
  const { items } = await import("../lib/content/items.ts");
  const right = (key) =>
    key.kind === "choice"
      ? { kind: "choice", option: key.correct }
      : key.kind === "multi"
        ? { kind: "multi", options: key.correct }
        : key.kind === "fill"
          ? { kind: "fill", word: key.correct }
          : key.kind === "order"
            ? { kind: "order", tiles: key.correct }
            : { kind: "match", pairs: key.correct };
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const balanceOf = (facts, currency) => (facts?.ledger ?? []).filter((e) => e.currency === currency).reduce((sum, e) => sum + e.amount, 0);
  let facts = (await call("GET", "state", undefined, token)).data.facts;
  const before = { xp: balanceOf(facts, "xp"), coins: balanceOf(facts, "coins") };
  let finished = 0;
  for (const quest of dailyQuests(day)) {
    let last = null;
    for (const [questionId, key] of Object.entries(quickQuestKeys[quest.id]))
      last = await call(
        "POST",
        "actions",
        { action: { type: "answerQuest", questId: quest.id, questionId, answer: right(key) }, locale: "ru" },
        token,
      );
    if (last?.status === 200 && last.data.outcome?.finished) finished++;
    facts = last?.data.facts ?? facts;
  }
  const earned = { xp: balanceOf(facts, "xp") - before.xp, coins: balanceOf(facts, "coins") - before.coins };
  check(
    finished === dailyQuests(day).length && earned.xp > 0 && earned.coins > 0,
    `the day's quick quests are completed and rewarded (+${earned.xp} XP, +${earned.coins} coins)`,
  );
  const first = dailyQuests(day)[0];
  const replay = await call(
    "POST",
    "actions",
    {
      action: {
        type: "answerQuest",
        questId: first.id,
        questionId: Object.keys(quickQuestKeys[first.id])[0],
        answer: right(Object.values(quickQuestKeys[first.id])[0]),
      },
    },
    token,
  );
  check(replay.status === 409, "a finished quest cannot be played again for more");
  const coins = balanceOf(facts, "coins");
  const owned = new Set((facts.inventory ?? []).map((i) => i.item));
  const affordable = items
    .filter((i) => i.price > 0 && i.price <= coins && i.level <= 1 && !owned.has(i.id))
    .sort((a, b) => a.price - b.price)[0];
  if (affordable) {
    const bought = await call("POST", "actions", { action: { type: "buy", itemId: affordable.id } }, token);
    check(
      bought.status === 200 &&
        balanceOf(bought.data.facts, "coins") === coins - affordable.price &&
        bought.data.facts.inventory.some((i) => i.item === affordable.id),
      `a shop purchase takes ${affordable.price} coins once and adds the item`,
    );
    const twice = await call("POST", "actions", { action: { type: "buy", itemId: affordable.id } }, token);
    check(twice.status === 409, "the same item is not sold twice");
  } else {
    // Today's quests did not pay enough for any level-1 item (the rotation decides): the purchase
    // itself is not tested today, which is said as such; the refusal for too few coins is.
    const cheapest = items.filter((i) => i.price > 0 && i.level <= 1 && !owned.has(i.id)).sort((x, y) => x.price - y.price)[0];
    const refused = await call("POST", "actions", { action: { type: "buy", itemId: cheapest.id } }, token);
    check(refused.status === 409 && refused.data.error === "not_enough_coins", `with ${coins} coins, a ${cheapest.price}-coin item is refused`);
    console.log(`SKIP  no level-1 item costs at most ${coins} coins today: the purchase itself was not tested`);
  }

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

  // Audio (2026-10-25): a teacher's recording, checked by content, heard only by the group's students.
  const { readFileSync: readBytes } = await import("node:fs");
  const upload = (bytes, sessionToken, name) =>
    fetch(`${base}/api/v1/studio/media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Authorization: `Bearer ${sessionToken}`,
        "X-File-Name": encodeURIComponent(name),
      },
      body: bytes,
    }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
  const recording = await upload(readBytes("tests/fixtures/audio/ok.m4a"), tt, "live-check.m4a");
  check(recording.status === 200 && recording.data.asset?.mime === "audio/mp4", "a teacher uploads an M4A recording");
  const picture = await upload(readBytes("tests/fixtures/audio/notaudio.png"), tt, "picture.mp3");
  check(picture.status === 422 && picture.data.error === "type", "a picture named .mp3 is refused by its content");
  const byStudent = await upload(readBytes("tests/fixtures/audio/ok.mp3"), token, "student.mp3");
  check(byStudent.status === 403, "a student cannot upload");
  const assetId = recording.data.asset?.id;
  const v1 = (await call("GET", "studio/state", undefined, tt)).data.facts?.quests
    ?.find((q) => q.id === questId)
    ?.versions?.find((v) => v.version === 1);
  const voiced = structuredClone(v1.graph);
  voiced.chapters[0].scenes[0].audio = assetId;
  await studio({ type: "saveDraft", questId, graph: voiced, keys: v1.keys });
  const v2 = await studio({ type: "publish", questId });
  await studio({ type: "assign", groupId, campaign: own?.slug, version: 2, dueAt: null });
  check(v2.status === 200, "a campaign with the recording is published as v2 and assigned");
  const link = (await call("GET", "state", undefined, token)).data.facts?.world?.media?.[assetId];
  const heard = link ? await fetch(`${base}${link}`) : null;
  const part = link ? await fetch(`${base}${link}`, { headers: { Range: "bytes=0-99" } }) : null;
  check(
    heard?.status === 200 && heard.headers.get("content-type") === "audio/mp4" && part?.status === 206,
    "the group's student plays it, whole and in ranges",
  );
  const outsider = await call("POST", "session", { initData: initData(outsiderId) });
  check(outsider.status === 200 && !(outsider.data.facts?.world?.media ?? {})[assetId], "a student outside the group gets no link to it");
  const forgedLink = await fetch(`${base}/api/v1/media/${assetId}?ticket=forged`);
  check(forgedLink.status === 403, "a forged link opens nothing");
  const inUse = await call("POST", "studio/media/delete", { id: assetId }, tt);
  check(inUse.status === 409, "a recording a published version uses cannot be deleted");

  await db.query(
    "insert into questling.completions (user_id, kind, ref, at) select user_id, 'help_request', 'forgotten-academy/tower-2', now() from questling.auth_identities where provider = 'telegram' and subject = $1",
    [String(telegramId)],
  );
  const studentId = roster.data.facts?.members?.[0]?.userId;
  const reply = await studio({ type: "replyHelp", userId: studentId, ref: "forgotten-academy/tower-2", body: "Перечитай свиток." });
  const messages = (await call("GET", "state", undefined, token)).data.facts?.world?.messages ?? [];
  check(reply.status === 200 && messages.some((m) => m.body === "Перечитай свиток."), "the mentor's reply reaches the student");

  // ——— Voice acting with object storage (features gates B/C) ———
  const usageNow = await call("GET", "studio/objects/usage", undefined, tt);
  if (!usageNow.data.configured) console.log("SKIP  media storage is not configured on this deployment: voice acting uploads not checked");
  else {
    const { readFileSync } = await import("node:fs");
    const fixture = (name) => readFileSync(`tests/fixtures/video/${name}`);
    const uploadAs = async (who, kind, mime, bytes, extra = {}) => {
      const ask = await call("POST", "media/upload", { kind, mime, size: bytes.length, rights: true, ...extra }, who);
      if (ask.status !== 200) return ask;
      const put = await fetch(ask.data.url, { method: "PUT", body: bytes, headers: { "Content-Type": ask.data.contentType } });
      if (!put.ok) return { status: put.status, data: { error: "put" } };
      return call("POST", "media/complete", { id: ask.data.id, ...extra }, who);
    };
    const video = await uploadAs(tt, "video", "video/mp4", fixture("ok.mp4"));
    check(video.status === 200 && video.data.media?.durationMs > 2900, "a teacher's video goes to private storage and is checked by content");
    const junk = await uploadAs(tt, "video", "video/mp4", fixture("clip.mov"));
    check(junk.status === 422 && junk.data.error === "type", "a MOV named as MP4 is refused after the upload, and deleted");
    const byStudentVideo = await call("POST", "media/upload", { kind: "video", mime: "video/mp4", size: 100, rights: true }, token);
    check(byStudentVideo.status === 403, "a student cannot upload video");

    const scene = await studio({ type: "createDub", title: "Live check scene", cefr: "A2" });
    const sceneId = scene.data.outcome?.id;
    const slug = scene.data.facts?.dubs?.find((d) => d.id === sceneId)?.slug;
    const content = {
      ...scene.data.facts.dubs.find((d) => d.id === sceneId).versions[0].content,
      video: video.data.media?.id,
      trim: { start: 0, end: 3000 },
    };
    content.lines = [
      { ...content.lines[0], start: 0, end: 1400 },
      { ...content.lines[1], start: 1500, end: 2900 },
    ];
    await studio({ type: "saveDub", exerciseId: sceneId, content });
    const published = await studio({ type: "publishDub", exerciseId: sceneId });
    const assigned = await studio({ type: "assignDub", groupId, exerciseId: sceneId });
    check(published.status === 200 && assigned.status === 200, "the scene on that video is published and given to the group");

    const world = (await call("GET", "state", undefined, token)).data.facts?.world;
    check(world?.dubs?.some((d) => d.exercise === slug), "the group's student sees the scene");
    const videoLink = await call("POST", "media/link", { id: video.data.media?.id }, token);
    const ranged = videoLink.data.url ? await fetch(videoLink.data.url, { headers: { Range: "bytes=0-99" } }) : null;
    check(ranged?.status === 206, "the student plays the video through a short-lived signed link, in ranges");
    const outsiderSession = await call("POST", "session", { initData: initData(outsiderId) });
    const outsiderLink = await call("POST", "media/link", { id: video.data.media?.id }, outsiderSession.data.token);
    check(outsiderLink.status === 404, "a student outside the group gets no link to the video");

    await call("POST", "actions", { action: { type: "startDub", exercise: slug, role: "student", mode: "voiceover" } }, token);
    const wrongLine = await uploadAs(token, "voice", "audio/webm", fixture("voice.webm"), { exercise: slug, line: "l1" });
    check(wrongLine.status === 409, "a take for another character's line is refused");
    const take = await uploadAs(token, "voice", "audio/webm", fixture("voice.webm"), { exercise: slug, line: "l2" });
    check(take.status === 200, "the student's take goes up, checked as sound");
    const sent = await call("POST", "actions", { action: { type: "submitDub", exercise: slug } }, token);
    check(sent.status === 200 && sent.data.facts?.dubs?.[0]?.status === "submitted", "the recording is sent to the teacher");
    const toReview = (await call("GET", "studio/state", undefined, tt)).data.facts?.dubSubmissions?.[0];
    const heardTake = await call("POST", "media/link", { id: toReview?.takes?.[0]?.mediaId }, tt);
    check(heardTake.status === 200, "the teacher hears the student's take");
    const approved = await studio({ type: "reviewDub", submissionId: toReview?.id, decision: "approve", rubric: { pacing: "good" } });
    const ledgerAfter = (await call("GET", "state", undefined, token)).data.facts?.ledger ?? [];
    check(approved.status === 200 && ledgerAfter.some((l) => l.key === `dub:${slug}@1` && l.amount === 40), "the teacher approves, and the XP is granted once");
    const inUseVideo = await call("POST", "studio/objects/delete", { id: video.data.media?.id }, tt);
    check(inUseVideo.status === 409, "a video a published scene uses cannot be deleted");
  }

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
  // Objects the check put in storage go first (rows alone would leave files in the bucket).
  const stored = await db.query(
    `select o.storage_key from questling.media_objects o join questling.auth_identities a on a.user_id = coalesce(o.teacher_id, o.user_id)
      where (a.provider = 'telegram' and a.subject = any($1::text[])) or (a.provider = 'supabase' and a.subject = $2)`,
    [[String(telegramId), String(outsiderId)], teacherAuthId],
  );
  const mediaEnv = (key) => process.env[key] ?? env[key];
  if (stored.rowCount && mediaEnv("MEDIA_S3_ENDPOINT")) {
    const { presign } = await import("../lib/server/sigv4.ts");
    const creds = {
      accessKeyId: mediaEnv("MEDIA_S3_ACCESS_KEY_ID"),
      secretAccessKey: mediaEnv("MEDIA_S3_SECRET_ACCESS_KEY"),
      region: mediaEnv("MEDIA_S3_REGION"),
    };
    for (const { storage_key } of stored.rows) {
      const url = new URL(`${mediaEnv("MEDIA_S3_ENDPOINT").replace(/\/+$/, "")}/${mediaEnv("MEDIA_S3_BUCKET")}/${storage_key}`);
      await fetch(presign(creds, { method: "DELETE", url, expires: 60 }), { method: "DELETE" }).catch(() => null);
    }
    console.log(`cleaned up ${stored.rowCount} stored object(s)`);
  }
  // Remove the test student and everything of theirs.
  const removed = await db.query(
    "delete from questling.users where id in (select user_id from questling.auth_identities where provider = 'telegram' and subject = any($1::text[]))",
    [[String(telegramId), String(outsiderId)]],
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
