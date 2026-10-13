// The trial stand with real accounts: people signed in the way Telegram signs them in (with the STAND's bot token,
// from .env.staging, never production's), a group, expenses in two currencies, and then everything this branch
// added on the server: files made there and fetched by signed address, the backup, and what one person cannot do
// to another's. Everything it creates is deleted at the end, and the database's counts are compared before and after.
//
//   node scripts/staging-accounts-check.mjs https://splitly-staging-phi.vercel.app
import { createHmac, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";
import { stagingEnv } from "./staging-env.mjs";

const base = process.argv[2];
if (!base || /splitly-self\.vercel\.app/.test(base)) {
  console.error("give the trial stand's address (never the production site's)");
  process.exit(1);
}
const env = stagingEnv();
if (env.problems.length > 0) {
  for (const problem of env.problems) console.error(`PROBLEM  ${problem}`);
  process.exit(1);
}
const out = ".tmp/staging-accounts";
mkdirSync(out, { recursive: true });

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ok   " : "  FAIL "} ${name}${ok ? "" : `  -> ${detail}`}`);
};

function initData(user, token = env.token, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: "AAF-staging-check", user: JSON.stringify(user) });
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
/** As Telegram's downloader fetches: the address alone. */
async function fetchFile(url) {
  const response = await fetch(`${base}${url}`);
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}

const db = new pg.Client({ connectionString: env.databaseUrl, ssl: { rejectUnauthorized: false } });
await db.connect();
const counts = async () =>
  (
    await db.query(
      `select (select count(*) from splitly.users)::int as users, (select count(*) from splitly.groups)::int as groups,
              (select count(*) from splitly.expenses)::int as expenses, (select count(*) from splitly.settlements)::int as settlements,
              (select count(*) from splitly.fx_rates)::int as rates, (select count(*) from splitly.invites)::int as invites`,
    )
  ).rows[0];
const before = await counts();
// Telegram IDs nobody has: high, and different on every run.
const seed = 7_700_000_000 + Math.floor(Math.random() * 1_000_000);
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

try {
  console.log("signing in");
  const ann = await person("Анна (проверка)", 1);
  const bob = await person("Bob (check)", 2);
  const stranger = await person("Stranger (check)", 3);
  check("three people sign in with data signed by the stand's bot", people.length === 3);
  const forged = await call("POST", "session", {
    body: { initData: initData({ id: seed + 9, first_name: "Forged" }, "1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") },
  });
  check("data signed with another bot's token is refused", forged.status === 401, `${forged.status}`);
  const stale = await call("POST", "session", {
    body: { initData: initData({ id: seed + 9, first_name: "Stale" }, env.token, Math.floor(Date.now() / 1000) - 3 * 3600) },
  });
  check("sign-in data three hours old is refused", stale.status === 401, `${stale.status}`);
  check("no session, no groups", (await call("GET", "groups")).status === 401);

  console.log("a group, two people, two currencies");
  const id = (await call("POST", "groups", { token: ann.token, body: { name: "Квартира (проверка)", baseCurrency: "TRY" } })).body.id;
  const invite = (await call("POST", `groups/${id}/invites`, { token: ann.token, body: {} })).body.invite;
  const joined = await call("POST", "invites/accept", { token: bob.token, body: { token: invite?.token } });
  check("an invitation brings the second person in", joined.status === 200 && joined.body.groupId === id, JSON.stringify(joined.body));
  const group = (await call("GET", `groups/${id}`, { token: ann.token })).body.group;
  const annM = group.members.find((member) => member.self).id;
  const bobM = group.members.find((member) => !member.self).id;
  const expense = (description, totalMinor, currency, category) => ({
    idempotencyKey: randomUUID(),
    expense: {
      description,
      category,
      date: new Date().toISOString().slice(0, 10),
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
    },
  });
  const first = await call("POST", `groups/${id}/expenses`, { token: ann.token, body: expense("Ужин, «Каракёй»", 100_01, "TRY", "food") });
  const second = await call("POST", `groups/${id}/expenses`, { token: ann.token, body: expense("Taxi", 50_00, "EUR", "transport") });
  check("two expenses are stored", first.status === 200 && second.status === 200, `${first.status} ${second.status}`);
  const after = (await call("GET", `groups/${id}`, { token: bob.token })).body.group;
  const shares = after.expenses
    .find((item) => item.currency === "TRY")
    .splits.map((split) => split.owedMinor)
    .sort();
  check("100.01 between two is 50.00 and 50.01, to the unit", JSON.stringify(shares) === "[5000,5001]", JSON.stringify(shares));
  check(
    "Bob owes in each currency apart",
    JSON.stringify(after.myNet) === JSON.stringify({ EUR: -2500, TRY: -5000 }) || (after.myNet.TRY === -5000 && after.myNet.EUR === -2500),
    JSON.stringify(after.myNet),
  );

  console.log("what a stranger cannot do");
  check("the group does not exist for them", (await call("GET", `groups/${id}`, { token: stranger.token })).status === 404);
  const rate = { from: "EUR", to: "TRY", rate: "1", effectiveDate: new Date().toISOString().slice(0, 10) };
  check(
    "they cannot record an exchange rate in it",
    (await call("POST", `groups/${id}/rates`, { token: stranger.token, body: rate })).status === 404,
  );
  check(
    "nor an expense",
    (await call("POST", `groups/${id}/expenses`, { token: stranger.token, body: expense("x", 100, "TRY", null) })).status === 404,
  );
  check(
    "the group's rates are untouched",
    (await db.query("select count(*)::int as n from splitly.fx_rates where group_id = $1", [id])).rows[0].n === 0,
  );
  const day = new Date().toISOString().slice(0, 10);
  const report = (format, more = {}) => ({
    kind: "report",
    groupId: id,
    locale: "ru",
    report: { format, sections: ["expenses", "debts", "payments"], period: "all", currency: null, day, ...more },
  });
  const refused = await call("POST", "downloads", { token: stranger.token, body: report("csv") });
  check("no download address is issued to them for it", refused.status === 404 && !refused.body.url, JSON.stringify(refused.body));
  check("none without a session", (await call("POST", "downloads", { body: report("csv") })).status === 401);

  console.log("files made on the server");
  const csvAsk = await call("POST", "downloads", { token: ann.token, body: report("csv") });
  check(
    "a member gets an address, with the file's Cyrillic name",
    csvAsk.status === 200 && csvAsk.body.name === "splitly-Квартира-проверка.csv",
    JSON.stringify(csvAsk.body.name),
  );
  const csv = await fetchFile(csvAsk.body.url);
  const text = csv.bytes.toString("utf8");
  check("the CSV comes, as a file to save", csv.status === 200 && /^attachment;/.test(csv.headers.get("content-disposition") ?? ""));
  check(
    "  with a byte-order mark and Cyrillic headings",
    text.charCodeAt(0) === 0xfeff && text.includes("Дата,Описание,Категория,Сумма,Валюта"),
  );
  check(
    "  the expense with its comma and quotes whole, sums exact",
    text.includes('"Ужин, «Каракёй»",food,100.01,TRY,active'),
    text.slice(0, 300),
  );
  check("  one debt per currency, never added", text.includes(",50.00,TRY") && text.includes(",25.00,EUR"));
  const xlsx = await fetchFile((await call("POST", "downloads", { token: ann.token, body: report("xlsx") })).body.url);
  check(
    "the workbook comes: a ZIP with the amount as a number",
    xlsx.bytes.subarray(0, 2).toString() === "PK" && xlsx.bytes.includes("<v>100.01</v>"),
  );
  const pdf = await fetchFile((await call("POST", "downloads", { token: ann.token, body: report("pdf") })).body.url);
  check(
    "the PDF comes",
    pdf.status === 200 && pdf.bytes.subarray(0, 5).toString() === "%PDF-" && pdf.bytes.length > 100_000,
    `${pdf.status} ${pdf.bytes.length}`,
  );
  writeFileSync(`${out}/report.pdf`, pdf.bytes);
  writeFileSync(`${out}/report.xlsx`, xlsx.bytes);
  const euros = await fetchFile(
    (await call("POST", "downloads", { token: bob.token, body: report("csv", { sections: ["expenses"], currency: "EUR" }) })).body.url,
  );
  const rows = euros.bytes.toString("utf8").trim().split("\r\n");
  check(
    "the other member gets it too; one currency asked, one currency given",
    rows.length === 2 && rows[1].includes(",50.00,EUR,"),
    rows.join(" | "),
  );

  console.log("the backup");
  const own = (await call("POST", "groups", { token: stranger.token, body: { name: "Stranger's own (check)", baseCurrency: "USD" } })).body
    .id;
  const backupOf = async (who) => {
    const asked = await call("POST", "downloads", { token: who.token, body: { kind: "backup" } });
    const file = await fetchFile(asked.body.url);
    return { text: file.bytes.toString("utf8"), data: JSON.parse(file.bytes.toString("utf8")) };
  };
  const [anns, bobs, strangers] = [await backupOf(ann), await backupOf(bob), await backupOf(stranger)];
  check(
    "Ann's holds her group, whole",
    anns.data.groups.length === 1 && anns.data.groups[0].id === id && anns.data.groups[0].expenses.length === 2,
  );
  check(
    "Bob's holds the same group and marks him as himself",
    bobs.data.groups.length === 1 && bobs.data.groups[0].members.find((member) => member.self)?.name === "Bob (check)",
  );
  check(
    "the stranger's holds only their own",
    strangers.data.groups.length === 1 && strangers.data.groups[0].id === own && !strangers.text.includes("Квартира"),
  );
  check(
    "nobody's holds anything that opens a door",
    [anns, bobs, strangers].every(({ text }) => !/token|initData|telegram|photo/i.test(text)),
  );

  console.log("a download address is good only as signed, and only for a while");
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
    "Ann's session in its place": ann.token,
  };
  for (const [what, bad] of Object.entries(attempts)) {
    const result = await fetchFile(`/api/v1/downloads/${bad}`);
    check(`refused: ${what}`, result.status === 404 && result.bytes.toString() === '{"error":"not_found"}', `${result.status}`);
  }
  check("an address is not a session", (await call("GET", "groups", { token: ticket })).status === 401);
  check("the same address works again within its five minutes", (await fetchFile(csvAsk.body.url)).status === 200);

  console.log("leaving the group takes the file away");
  await call("DELETE", `groups/${id}/members/${bobM}`, { token: ann.token });
  const bobAfter = await call("POST", "downloads", { token: bob.token, body: report("csv") });
  check("a removed member gets no new address", bobAfter.status === 404, `${bobAfter.status}`);
  check("and nothing in their backup", (await backupOf(bob)).data.groups.length === 0);
} catch (error) {
  failed++;
  console.log(`  FAIL  stopped: ${error.message}`);
} finally {
  // Everything made here goes: each person deletes their own account, which takes their own groups with it.
  for (const one of people) await call("DELETE", "me", { token: one.token }).catch(() => {});
  await db.query("delete from splitly.rate_limits").catch(() => {});
  const left = await counts();
  check(
    "the database is as it was before",
    JSON.stringify(left) === JSON.stringify(before),
    `${JSON.stringify(before)} -> ${JSON.stringify(left)}`,
  );
  await db.end();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
