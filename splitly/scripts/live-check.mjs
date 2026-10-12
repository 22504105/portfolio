// The stage-2 gate against the REAL database: two test people, signed in the
// way Telegram signs people in (with the bot's own token, read from
// .env.local and never printed), must not be able to read or change each
// other's groups. Everything the check creates is deleted at the end.
//
//   node scripts/live-check.mjs                 starts the built site locally with .env.local
//   node scripts/live-check.mjs https://…       checks a deployed site instead
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].trim()]),
);
const remote = process.argv[2];
const PORT = 3312;
const base = remote ?? `http://localhost:${PORT}`;
const server = remote
  ? null
  : spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, ...env }, stdio: "ignore" });

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  ${detail}`}`);
};

function initData(user, token = env.TELEGRAM_BOT_TOKEN) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAF-live-check",
    user: JSON.stringify(user),
  });
  const lines = [...params]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(lines).digest("hex"));
  return params.toString();
}

async function call(method, path, { token, body, origin } = {}) {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

// Telegram IDs far outside what the check's owner would have; removed at the end.
const ANN = { id: 9_900_000_001, first_name: "Check Ann", language_code: "en" };
const BOB = { id: 9_900_000_002, first_name: "Check Bob", language_code: "ru" };
const tokens = [];

// The database holds real people's data too. The check counts what is there before it starts and must leave exactly that.
const COUNTS =
  "select (select count(*)::int from splitly.users) users, (select count(*)::int from splitly.groups) groups, (select count(*)::int from splitly.expenses) expenses, (select count(*)::int from splitly.telegram_identities) identities";
async function counts() {
  const db = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    return (await db.query(COUNTS)).rows[0];
  } finally {
    await db.end();
  }
}
const before = await counts();

try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const forged = await call("POST", "session", { body: { initData: initData(ANN, "123456:not-the-real-token-AAAAAAAAAAAAAAAAAAAAAAAA") } });
  check("sign-in data signed with another token is refused", forged.status === 401, JSON.stringify(forged));
  const swapped = new URLSearchParams(initData(ANN));
  swapped.set("user", JSON.stringify(BOB));
  check(
    "sign-in data altered after signing is refused",
    (await call("POST", "session", { body: { initData: swapped.toString() } })).status === 401,
  );

  const ann = await call("POST", "session", { body: { initData: initData(ANN) } });
  const bob = await call("POST", "session", { body: { initData: initData(BOB) } });
  check(
    "two people sign in with data signed by the real bot",
    ann.status === 200 && bob.status === 200,
    `${ann.status} ${bob.status} ${JSON.stringify(ann.body)}`,
  );
  if (ann.status !== 200 || bob.status !== 200) throw new Error("cannot continue without sessions");
  tokens.push(ann.body.token, bob.body.token);
  const [A, B] = tokens;
  check("each has a profile in their own language", ann.body.profile.locale === "en" && bob.body.profile.locale === "ru");
  check(
    "nothing is readable without a session",
    (await call("GET", "groups")).status === 401 && (await call("GET", "groups", { token: "forged.token" })).status === 401,
  );

  const groupA = (await call("POST", "groups", { token: A, body: { name: "Check: Ann's private group", baseCurrency: "TRY" } })).body.id;
  const groupB = (await call("POST", "groups", { token: B, body: { name: "Check: Bob's private group", baseCurrency: "EUR" } })).body.id;
  check("each creates a private group", Boolean(groupA && groupB));
  const memberA = (await call("GET", `groups/${groupA}`, { token: A })).body.group.members[0].id;
  const guest = (await call("POST", `groups/${groupA}/members`, { token: A, body: { name: "Guest" } })).body.id;
  const expense = (payer, people, total) => ({
    description: "Check dinner",
    category: "food",
    date: "2026-10-12",
    currency: "TRY",
    totalMinor: total,
    payers: [{ memberId: payer, paidMinor: total }],
    split: { mode: "equal", parts: people.map((memberId) => ({ memberId, value: 1 })) },
  });
  const key = randomUUID();
  const first = await call("POST", `groups/${groupA}/expenses`, {
    token: A,
    body: { idempotencyKey: key, expense: expense(memberA, [memberA, guest], 1001) },
  });
  const again = await call("POST", `groups/${groupA}/expenses`, {
    token: A,
    body: { idempotencyKey: key, expense: expense(memberA, [memberA, guest], 1001) },
  });
  check(
    "an expense is stored, and the same submission twice is one expense",
    first.status === 200 && again.body.id === first.body.id && again.body.repeated === true,
    JSON.stringify([first, again]),
  );
  const seen = (await call("GET", `groups/${groupA}`, { token: A })).body.group;
  check(
    "shares are worked out by the server and the balance follows",
    seen.expenses.length === 1 && seen.expenses[0].splits.map((split) => split.owedMinor).join() === "501,500" && seen.myNet.TRY === 500,
    JSON.stringify(seen.myNet),
  );

  const listA = (await call("GET", "groups", { token: A })).body.groups.map((group) => group.id);
  const listB = (await call("GET", "groups", { token: B })).body.groups.map((group) => group.id);
  check("each sees only their own group", listA.join() === groupA && listB.join() === groupB, JSON.stringify([listA, listB]));

  const nowhere = randomUUID();
  const attempts = [
    ["GET", "groups/G"],
    ["PATCH", "groups/G", { name: "Taken over" }],
    ["DELETE", "groups/G"],
    ["POST", "groups/G/members", { name: "Mallory" }],
    ["DELETE", `groups/G/members/${memberA}`],
    ["POST", "groups/G/invites", {}],
    ["POST", "groups/G/expenses", { idempotencyKey: randomUUID(), expense: expense(memberA, [memberA], 5) }],
    ["PUT", `groups/G/expenses/${first.body.id}`, { idempotencyKey: randomUUID(), expense: expense(memberA, [memberA], 5) }],
    ["DELETE", `groups/G/expenses/${first.body.id}`],
  ];
  let leaks = 0;
  for (const [method, path, body] of attempts) {
    const real = await call(method, path.replace("G", groupA), { token: B, body });
    const missing = await call(method, path.replace("G", nowhere), { token: B, body });
    if (real.status !== 404 || JSON.stringify(real.body) !== JSON.stringify(missing.body) || missing.status !== 404) {
      leaks++;
      console.log("     ", method, path, real.status, JSON.stringify(real.body));
    }
  }
  check(
    `Bob cannot read or change Ann's group by any of ${attempts.length} routes; each answers as for a group that does not exist`,
    leaks === 0,
  );
  const memberB = (await call("GET", `groups/${groupB}`, { token: B })).body.group.members[0].id;
  const smuggle = await call("POST", `groups/${groupB}/expenses`, {
    token: B,
    body: { idempotencyKey: randomUUID(), expense: expense(memberB, [memberB, memberA], 100) },
  });
  check("Bob cannot put Ann's member into an expense of his own group", smuggle.status === 422, JSON.stringify(smuggle));
  const after = (await call("GET", `groups/${groupA}`, { token: A })).body.group;
  check(
    "Ann's group is exactly as she left it",
    after.name === "Check: Ann's private group" &&
      after.members.length === 2 &&
      after.expenses.length === 1 &&
      after.expenses[0].status === "active",
  );

  check(
    "a request from another site is refused",
    (await call("POST", "groups", { token: A, body: { name: "x", baseCurrency: "TRY" }, origin: "https://evil.example" })).status === 403,
  );

  const invite = (await call("POST", `groups/${groupA}/invites`, { token: A, body: {} })).body.invite.token;
  const joined = await call("POST", "invites/accept", { token: B, body: { token: invite, claimMemberId: guest } });
  const shared = (await call("GET", `groups/${groupA}`, { token: B })).body.group;
  check(
    "with Ann's invitation Bob joins as the guest he was, and now sees the group",
    joined.status === 200 && shared?.myNet.TRY === -500,
    JSON.stringify([joined, shared?.myNet]),
  );

  // Stage 3: a receipt becomes one expense with its lines, shares worked out by the server; the same photo twice is noticed.
  const line = (displayLabel, lineTotalMinor, assigned, extra = {}) => ({
    kind: "item",
    originalLabel: displayLabel.toUpperCase(),
    displayLabel,
    translationSource: "glossary",
    quantity: "1",
    lineTotalMinor,
    confidence: 90,
    manualReviewed: false,
    assigned: assigned.map((memberId) => ({ memberId, weight: 1 })),
    ...extra,
  });
  const receipt = {
    description: "Check receipt",
    category: "groceries",
    date: "2026-10-12",
    currency: "TRY",
    payers: [{ memberId: memberA, paidMinor: 11_001 }],
    receipt: {
      contentHash: "c0ffee".padEnd(64, "0"),
      mimeType: "image/png",
      lines: [
        line("Milk", 8001, [memberA, guest]),
        line("Bread", 4000, [guest]),
        line("Discount", -1000, [], { kind: "discount", confidence: null }),
      ],
    },
  };
  const scanned = await call("POST", `groups/${groupA}/receipts`, { token: A, body: { idempotencyKey: randomUUID(), receipt } });
  const withReceipt = (await call("GET", `groups/${groupA}`, { token: B })).body.group;
  const stored = withReceipt?.expenses.find((expense) => expense.id === scanned.body.id);
  const lineSums = stored?.receipt?.lines.map((item) => item.allocations.reduce((sum, share) => sum + share.shareMinor, 0)).join();
  check(
    "a receipt is stored as one expense whose lines, shares and total agree",
    scanned.status === 200 &&
      stored?.totalMinor === 11_001 &&
      lineSums === "8001,4000,-1000" &&
      stored.splits.reduce((sum, split) => sum + split.owedMinor, 0) === 11_001,
    JSON.stringify([scanned, lineSums, stored?.splits]),
  );
  const twice = await call("POST", `groups/${groupA}/receipts`, { token: A, body: { idempotencyKey: randomUUID(), receipt } });
  check(
    "the same photo a second time is refused as a duplicate",
    twice.status === 409 && twice.body.error === "duplicate_receipt",
    JSON.stringify(twice),
  );
  const half = await call("POST", `groups/${groupA}/receipts`, {
    token: A,
    body: {
      idempotencyKey: randomUUID(),
      receipt: { ...receipt, receipt: { ...receipt.receipt, contentHash: "d".repeat(64), lines: [line("Milk", 8001, [])] } },
    },
  });
  check("a receipt with a line given to nobody is refused whole", half.status === 422, JSON.stringify(half));
} catch (error) {
  failed++;
  console.log("FAIL the check itself broke:", error.message);
} finally {
  // Remove what the check made: the accounts through the API, then anything left behind directly.
  for (const token of tokens) await call("DELETE", "me", { token }).catch(() => {});
  const db = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query("delete from splitly.groups where name like 'Check: %'");
  await db.query(
    "delete from splitly.users where id in (select user_id from splitly.telegram_identities where telegram_user_id in ($1, $2))",
    [ANN.id, BOB.id],
  );
  const left = (await db.query(COUNTS)).rows[0];
  await db.end();
  check(
    "the test accounts and their data are gone, and everything that was there before is still there",
    JSON.stringify(left) === JSON.stringify(before),
    `before ${JSON.stringify(before)} after ${JSON.stringify(left)}`,
  );
  server?.kill();
}
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
