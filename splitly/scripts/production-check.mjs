// A check of the PRODUCTION site with accounts, after a deployment. It cannot be done without making test people
// in the real database, so it is made to be safe there:
//
//   - the test people have Telegram IDs far outside any real one, and the check stops before doing anything if
//     signing them in did not create exactly that many new users (so it can never act as a real person);
//   - it writes only through the site's own API, as those people; it never touches a record it did not make;
//   - it removes everything by each test person deleting their own account, which is how the app does it;
//   - the database is only ever counted, in read-only transactions, before and after, and the counts must match.
//
//   node scripts/production-check.mjs https://splitly-self.vercel.app
//
// The bot's token and the database address are read from .env.local and never printed.
import { createHmac, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const base = process.argv[2];
if (!base) {
  console.error("give the site's address");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(process.env.CHECK_ENV_FILE ?? ".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].trim().replace(/^["']|["']$/g, "")]),
);
const out = ".tmp/production-check";
mkdirSync(out, { recursive: true });

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ok   " : "  FAIL "} ${name}${ok ? "" : `  -> ${detail}`}`);
};

function initData(user, token = env.TELEGRAM_BOT_TOKEN, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: "AAF-production-check", user: JSON.stringify(user) });
  const lines = [...params]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(lines).digest("hex"));
  return params.toString();
}
async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
async function fetchFile(url) {
  const response = await fetch(`${base}${url}`);
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}

const db = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
/** Counts only, read-only: nothing of anyone's is read. */
async function counts() {
  await db.query("begin transaction read only");
  try {
    return (
      await db.query(
        `select (select count(*) from splitly.users)::int as users, (select count(*) from splitly.telegram_identities)::int as identities,
                (select count(*) from splitly.groups)::int as groups, (select count(*) from splitly.group_members)::int as members,
                (select count(*) from splitly.expenses)::int as expenses, (select count(*) from splitly.settlements)::int as settlements,
                (select count(*) from splitly.fx_rates)::int as rates, (select count(*) from splitly.receipts)::int as receipts,
                (select count(*) from splitly.invites)::int as invites, (select count(*) from splitly.activity_log)::int as activity`,
      )
    ).rows[0];
  } finally {
    await db.query("rollback");
  }
}
const before = await counts();
console.log(`before: ${JSON.stringify(before)}`);

// Far beyond any ID Telegram has given anyone, and different on every run.
const seed = 9_000_000_000_000 + Math.floor(Math.random() * 1_000_000_000);
const people = [];
async function person(name, offset) {
  const result = await call("POST", "session", {
    body: { initData: initData({ id: seed + offset, first_name: name, language_code: "ru" }) },
  });
  if (result.status !== 200) throw new Error(`sign-in of ${name} failed: ${result.status} ${JSON.stringify(result.body)}`);
  const one = { name, token: result.body.token, userId: result.body.profile.id };
  people.push(one);
  return one;
}

let safe = false;
try {
  console.log("signing in (Telegram's way, with the production bot's own signature)");
  const ann = await person("Проверка А", 1);
  const bob = await person("Check B", 2);
  const stranger = await person("Check C", 3);
  const signedIn = await counts();
  // Three sign-ins must have made three new people. If not, one of them is somebody real: stop, delete nothing.
  safe = signedIn.users === before.users + 3 && signedIn.identities === before.identities + 3;
  check("three new people, and nobody who was there before", safe, `${before.users} -> ${signedIn.users}`);
  if (!safe) throw new Error("the test people are not all new: stopping without touching anything");
  check(
    "the same person signs in again as themselves",
    (await call("POST", "session", { body: { initData: initData({ id: seed + 1, first_name: "Проверка А" }) } })).body.profile?.id ===
      ann.userId,
  );
  const forged = await call("POST", "session", {
    body: { initData: initData({ id: seed + 9, first_name: "Forged" }, "1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") },
  });
  check("data signed with another bot's token is refused", forged.status === 401, `${forged.status}`);
  const stale = await call("POST", "session", {
    body: { initData: initData({ id: seed + 9, first_name: "Stale" }, env.TELEGRAM_BOT_TOKEN, Math.floor(Date.now() / 1000) - 3 * 3600) },
  });
  check("sign-in data three hours old is refused", stale.status === 401, `${stale.status}`);
  check("no session, no groups", (await call("GET", "groups")).status === 401);
  check(
    "a new person sees no groups: nobody else's are shown",
    (await call("GET", "groups", { token: stranger.token })).body.groups?.length === 0,
  );

  console.log("groups and invitations");
  const id = (await call("POST", "groups", { token: ann.token, body: { name: "Проверка выкладки", baseCurrency: "TRY" } })).body.id;
  const invite = (await call("POST", `groups/${id}/invites`, { token: ann.token, body: {} })).body.invite;
  const preview = await call("POST", "invites/preview", { token: bob.token, body: { token: invite?.token } });
  check(
    "the invitation shows the group's name before it is accepted",
    preview.body.groupName === "Проверка выкладки",
    JSON.stringify(preview.body),
  );
  const joined = await call("POST", "invites/accept", { token: bob.token, body: { token: invite?.token } });
  check("accepting it brings the second person in", joined.status === 200 && joined.body.groupId === id, JSON.stringify(joined.body));
  check(
    "a made-up invitation is refused",
    (await call("POST", "invites/accept", { token: stranger.token, body: { token: "not-an-invitation" } })).status >= 400,
  );
  const guest = await call("POST", `groups/${id}/members`, { token: ann.token, body: { name: "Гость" } });
  check("someone is added by name", guest.status === 200, `${guest.status}`);
  const group = (await call("GET", `groups/${id}`, { token: ann.token })).body.group;
  const annM = group.members.find((member) => member.self).id;
  const bobM = group.members.find((member) => !member.self && !member.guest).id;
  const day = new Date().toISOString().slice(0, 10);
  const expense = (description, totalMinor, currency, category) => ({
    description,
    category,
    date: day,
    currency,
    totalMinor,
    payers: [{ memberId: annM, paidMinor: totalMinor }],
    split: {
      mode: "equal",
      parts: [
        { memberId: annM, value: 1 },
        { memberId: bobM, value: 1 },
      ],
    },
  });

  console.log("expenses: made, changed, cancelled");
  const made = await call("POST", `groups/${id}/expenses`, {
    token: ann.token,
    body: { idempotencyKey: randomUUID(), expense: expense("Ужин, «Каракёй»", 100_01, "TRY", "food") },
  });
  check("an expense is stored", made.status === 200, `${made.status} ${JSON.stringify(made.body)}`);
  const key = randomUUID();
  const twice = [
    await call("POST", `groups/${id}/expenses`, {
      token: ann.token,
      body: { idempotencyKey: key, expense: expense("Taxi", 50_00, "EUR", "transport") },
    }),
    await call("POST", `groups/${id}/expenses`, {
      token: ann.token,
      body: { idempotencyKey: key, expense: expense("Taxi", 50_00, "EUR", "transport") },
    }),
  ];
  check(
    "the same form sent twice makes one expense",
    twice[0].body.id && twice[0].body.id === twice[1].body.id,
    JSON.stringify(twice.map((one) => one.body)),
  );
  let now = (await call("GET", `groups/${id}`, { token: bob.token })).body.group;
  const shares = now.expenses
    .find((item) => item.currency === "TRY")
    .splits.map((split) => split.owedMinor)
    .sort();
  check("100.01 between two is 50.00 and 50.01, to the unit", JSON.stringify(shares) === "[5000,5001]", JSON.stringify(shares));
  check("what Bob owes stands in each currency apart", now.myNet.TRY === -5000 && now.myNet.EUR === -2500, JSON.stringify(now.myNet));
  const changed = await call("PUT", `groups/${id}/expenses/${made.body.id}`, {
    token: ann.token,
    body: { idempotencyKey: randomUUID(), expense: expense("Ужин, «Каракёй»", 120_00, "TRY", "food") },
  });
  now = (await call("GET", `groups/${id}`, { token: bob.token })).body.group;
  check(
    "changing it writes a new one and keeps the old on record",
    changed.status === 200 &&
      now.expenses.some((item) => item.id === made.body.id && item.status === "replaced") &&
      now.myNet.TRY === -6000,
    `${changed.status} ${JSON.stringify(now.myNet)}`,
  );
  const unbalanced = await call("POST", `groups/${id}/expenses`, {
    token: ann.token,
    body: { idempotencyKey: randomUUID(), expense: { ...expense("Bad", 100, "TRY", null), payers: [{ memberId: annM, paidMinor: 90 }] } },
  });
  check("an expense whose payments do not add up is refused", unbalanced.status === 422, `${unbalanced.status}`);
  const extra = await call("POST", `groups/${id}/expenses`, {
    token: bob.token,
    body: { idempotencyKey: randomUUID(), expense: expense("Лишний", 10_00, "TRY", null) },
  });
  await call("DELETE", `groups/${id}/expenses/${extra.body.id}`, { token: bob.token });
  now = (await call("GET", `groups/${id}`, { token: bob.token })).body.group;
  check(
    "a cancelled expense stays on record and counts for nothing",
    now.expenses.some((item) => item.id === extra.body.id && item.status === "cancelled") && now.myNet.TRY === -6000,
    JSON.stringify(now.myNet),
  );

  console.log("debts: a payment in part, confirmed by the one who was paid");
  const pay = await call("POST", `groups/${id}/settlements`, {
    token: bob.token,
    body: { idempotencyKey: randomUUID(), settlement: { fromMemberId: bobM, toMemberId: annM, currency: "TRY", amountMinor: 20_00 } },
  });
  now = (await call("GET", `groups/${id}`, { token: bob.token })).body.group;
  check(
    "Bob's word that he paid changes nothing yet",
    pay.status === 200 && now.myNet.TRY === -6000,
    `${pay.status} ${JSON.stringify(now.myNet)}`,
  );
  check(
    "Bob cannot confirm it himself",
    (await call("POST", `groups/${id}/settlements/${pay.body.id}/confirm`, { token: bob.token, body: {} })).status === 403,
  );
  await call("POST", `groups/${id}/settlements/${pay.body.id}/confirm`, { token: ann.token, body: {} });
  now = (await call("GET", `groups/${id}`, { token: bob.token })).body.group;
  check(
    "confirmed by Ann, 20.00 of 60.00 is paid off; the euros are untouched",
    now.myNet.TRY === -4000 && now.myNet.EUR === -2500,
    JSON.stringify(now.myNet),
  );
  const rate = await call("POST", `groups/${id}/rates`, {
    token: ann.token,
    body: { from: "EUR", to: "TRY", rate: "55,2325", effectiveDate: day },
  });
  now = (await call("GET", `groups/${id}`, { token: bob.token })).body.group;
  check(
    "a recorded exchange rate converts nobody's debt",
    rate.status === 200 && now.myNet.EUR === -2500 && now.myNet.TRY === -4000,
    JSON.stringify(now.myNet),
  );

  console.log("what a stranger cannot do");
  check("the group does not exist for them", (await call("GET", `groups/${id}`, { token: stranger.token })).status === 404);
  check(
    "they cannot record a rate in it",
    (await call("POST", `groups/${id}/rates`, { token: stranger.token, body: { from: "USD", to: "TRY", rate: "1", effectiveDate: day } }))
      .status === 404,
  );
  check(
    "nor an expense, nor a payment",
    (
      await call("POST", `groups/${id}/expenses`, {
        token: stranger.token,
        body: { idempotencyKey: randomUUID(), expense: expense("x", 100, "TRY", null) },
      })
    ).status === 404,
  );
  const report = (format, more = {}) => ({
    kind: "report",
    groupId: id,
    locale: "ru",
    report: { format, sections: ["expenses", "debts", "payments"], period: "all", currency: null, day, ...more },
  });
  check(
    "no download address is issued to them",
    (await call("POST", "downloads", { token: stranger.token, body: report("csv") })).status === 404,
  );
  check("none without a session", (await call("POST", "downloads", { body: report("csv") })).status === 401);

  console.log("files made on the server, by signed address");
  const csvAsk = await call("POST", "downloads", { token: ann.token, body: report("csv") });
  check(
    "a member gets an address and the file's name",
    csvAsk.status === 200 && csvAsk.body.name === "splitly-Проверка-выкладки.csv",
    JSON.stringify(csvAsk.body.name),
  );
  const csv = await fetchFile(csvAsk.body.url);
  const text = csv.bytes.toString("utf8");
  check(
    "CSV: a file to save, byte-order mark, Cyrillic headings",
    csv.status === 200 &&
      /^attachment;/.test(csv.headers.get("content-disposition") ?? "") &&
      text.charCodeAt(0) === 0xfeff &&
      text.includes("Дата,Описание,Категория,Сумма,Валюта"),
  );
  check(
    "CSV: the changed expense with its comma and quotes, both states, exact sums",
    text.includes('"Ужин, «Каракёй»",food,120.00,TRY,active') && text.includes('"Ужин, «Каракёй»",food,100.01,TRY,replaced'),
    text.slice(0, 400),
  );
  check("CSV: the debts after the part payment, one per currency", /,40\.00,TRY/.test(text) && /,25\.00,EUR/.test(text));
  check("CSV: the payment, confirmed", /,20\.00,TRY,confirmed/.test(text));
  const xlsx = await fetchFile((await call("POST", "downloads", { token: ann.token, body: report("xlsx") })).body.url);
  check(
    "XLSX: a ZIP with amounts as numbers and Cyrillic sheet names",
    xlsx.bytes.subarray(0, 2).toString() === "PK" && xlsx.bytes.includes("<v>120.00</v>") && xlsx.bytes.includes('<sheet name="Расходы"'),
  );
  const pdf = await fetchFile((await call("POST", "downloads", { token: ann.token, body: report("pdf") })).body.url);
  check(
    "PDF: made on the production server",
    pdf.status === 200 && pdf.bytes.subarray(0, 5).toString() === "%PDF-" && pdf.bytes.length > 100_000,
    `${pdf.status} ${pdf.bytes.length}`,
  );
  writeFileSync(`${out}/report.pdf`, pdf.bytes);
  writeFileSync(`${out}/report.xlsx`, xlsx.bytes);
  const euros = (
    await fetchFile(
      (await call("POST", "downloads", { token: bob.token, body: report("csv", { sections: ["expenses"], currency: "EUR" }) })).body.url,
    )
  ).bytes
    .toString("utf8")
    .trim()
    .split("\r\n");
  check("one currency asked, one currency given", euros.length === 2 && euros[1].includes(",50.00,EUR,"), euros.join(" | "));
  const backupOf = async (who) => {
    const file = await fetchFile((await call("POST", "downloads", { token: who.token, body: { kind: "backup" } })).body.url);
    return { text: file.bytes.toString("utf8"), data: JSON.parse(file.bytes.toString("utf8")) };
  };
  const [anns, strangers] = [await backupOf(ann), await backupOf(stranger)];
  check(
    "JSON backup: the test person's own group, whole, and nothing else",
    anns.data.groups.length === 1 &&
      anns.data.groups[0].id === id &&
      anns.data.groups[0].settlements.length === 1 &&
      anns.data.groups[0].rates.length === 1,
  );
  check(
    "JSON backup: a stranger's is empty; no real group is in either",
    strangers.data.groups.length === 0 && !strangers.text.includes("Проверка выкладки"),
  );
  check("JSON backup: nothing in it opens a door", !/token|initData|telegram|photo/i.test(anns.text));

  console.log("a download address only as signed, only for a while");
  const ticket = csvAsk.body.url.split("/").pop();
  const [payload, signature] = ticket.split(".");
  const edited = (change) => {
    const note = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    change(note);
    return `${Buffer.from(JSON.stringify(note)).toString("base64url")}.${signature}`;
  };
  const attempts = {
    "made out to the stranger": edited((note) => (note.u = stranger.userId)),
    "its time made longer": edited((note) => (note.e += 86_400)),
    "pointed at the backup": edited((note) => (note.f = { kind: "backup" })),
    "its signature cut": `${payload}.${signature.slice(0, -2)}AA`,
    "no signature": payload,
    "a session in its place": ann.token,
  };
  for (const [what, bad] of Object.entries(attempts)) {
    const result = await fetchFile(`/api/v1/downloads/${bad}`);
    check(`refused: ${what}`, result.status === 404 && result.bytes.toString() === '{"error":"not_found"}', `${result.status}`);
  }
  check("an address is not a session", (await call("GET", "groups", { token: ticket })).status === 401);
  const note = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  check(
    "it is good for five minutes, no more",
    note.e - Math.floor(Date.now() / 1000) <= 300 && note.e - Math.floor(Date.now() / 1000) > 200,
  );
} catch (error) {
  failed++;
  console.log(`  FAIL  stopped: ${error.message}`);
} finally {
  // Each test person deletes their own account, as the app does it, which takes their own groups with it.
  // Only if every one of them was made by this run.
  if (safe) for (const one of people) await call("DELETE", "me", { token: one.token }).catch(() => {});
  const after = await counts();
  console.log(`after:  ${JSON.stringify(after)}`);
  check(
    "the database holds exactly what it held before",
    JSON.stringify(after) === JSON.stringify(before),
    `${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
  );
  await db.end();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
