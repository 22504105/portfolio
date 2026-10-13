import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import { handle } from "@/lib/server/api";

// The trial deployment's check of itself: it makes the demo group's report on
// the server and hands it out by a signed address, with no database. It must
// work where it is switched on, and not exist anywhere else.

const SECRET = "self-test-only-secret-of-at-least-32-characters";
const ORIGIN = "https://staging.test";

const get = async (path: string) => {
  const response = await handle(new Request(`${ORIGIN}/api/v1/${path}`), path.split("?")[0].split("/"));
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
};
const on = () => {
  process.env.SPLITLY_SELFTEST = "1";
  process.env.SESSION_SECRET = SECRET;
  process.env.DATABASE_URL = "";
  process.env.TELEGRAM_BOT_TOKEN = "";
};

afterEach(() => {
  for (const name of ["SPLITLY_SELFTEST", "SESSION_SECRET", "DATABASE_URL", "TELEGRAM_BOT_TOKEN"]) delete process.env[name];
});

describe("the self-test of a trial deployment", () => {
  it("makes the demo group's PDF, with its Cyrillic, through a signed address", async () => {
    on();
    const link = JSON.parse((await get("selftest/link?format=pdf&locale=ru")).bytes.toString("utf8"));
    expect(link.goodForSeconds).toBe(300);
    const file = await get(link.url.replace("/api/v1/", ""));
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("application/pdf");
    expect(decodeURIComponent(file.headers.get("content-disposition")!)).toContain("splitly-Выходные-в-Стамбуле.pdf");
    const pdf = await PDFDocument.load(file.bytes);
    expect(pdf.getTitle()).toBe("Splitly · Выходные в Стамбуле");
    expect(pdf.getPageCount()).toBe(1);

    const csv = JSON.parse((await get("selftest/link?format=csv&locale=ru")).bytes.toString("utf8"));
    expect((await get(csv.url.replace("/api/v1/", ""))).bytes.toString("utf8")).toContain("Керем,Алексей,830.12,TRY");
  }, 30_000);

  it("refuses an address that is out of date, altered, or signed elsewhere, and a request that is not one", async () => {
    on();
    const stale = JSON.parse((await get("selftest/link?format=csv&age=301")).bytes.toString("utf8"));
    expect(stale.goodForSeconds).toBe(-1);
    expect((await get(stale.url.replace("/api/v1/", ""))).status).toBe(404);
    // One second inside its time, it still works.
    const fresh = JSON.parse((await get("selftest/link?format=csv&age=298")).bytes.toString("utf8"));
    expect((await get(fresh.url.replace("/api/v1/", ""))).status).toBe(200);

    const good = (JSON.parse((await get("selftest/link?format=csv")).bytes.toString("utf8")).url as string).replace("/api/v1/", "");
    const [payload, signature] = good.split("/").pop()!.split(".");
    const note = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const longer = Buffer.from(JSON.stringify({ ...note, e: note.e + 86_400 })).toString("base64url");
    for (const bad of [`${longer}.${signature}`, `${payload}.${signature.slice(0, -2)}AA`, payload, "x.y"])
      expect([bad.slice(0, 12), (await get(`selftest/file/${bad}`)).status]).toEqual([bad.slice(0, 12), 404]);

    process.env.SESSION_SECRET = "another-secret-of-at-least-32-characters-long";
    expect((await get(good)).status).toBe(404);
    process.env.SESSION_SECRET = SECRET;
    for (const query of ["format=exe", "locale=xx", "age=-5", "age=999999"])
      expect([query, (await get(`selftest/link?${query}`)).status]).toEqual([query, 404]);
    expect((await get("selftest/anything")).status).toBe(404);
  });

  it("does not exist unless switched on, and cannot be switched on where there are accounts", async () => {
    // Not switched on.
    process.env.SESSION_SECRET = SECRET;
    expect((await get("selftest/link?format=pdf")).status).toBe(404);
    // Switched on, but with too short a secret to sign anything.
    process.env.SPLITLY_SELFTEST = "1";
    process.env.SESSION_SECRET = "short";
    expect((await get("selftest/link?format=pdf")).status).toBe(404);
    // Switched on, on a site that has a database and a bot: still nothing.
    process.env.SESSION_SECRET = SECRET;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5/none";
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    expect((await get("selftest/link?format=pdf")).status).toBe(404);
    const made = (await get("selftest/file/x.y")).bytes.toString("utf8");
    expect(made).toBe('{"error":"not_found"}');
  });
});
