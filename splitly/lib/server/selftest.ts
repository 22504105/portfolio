import "server-only";
import { checkReportAsk, makeReport } from "@/lib/export/make";
import { getDictionary, isLocale } from "@/lib/i18n";
import { createDemoStore, type Shelf } from "@/lib/store/demo";
import { accountsConfigured, serverEnv } from "./db";
import { fonts, respond } from "./download";
import { issueTicket, readTicket, TICKET_SECONDS } from "./session";

// A check of the file-making machinery where it will really run, for a trial
// deployment that has no database: the fonts beside the function, the PDF
// with Cyrillic in it, a download address being signed, read, refused when
// altered and refused when out of date.
//
// It works on the demo's invented group only and reads nothing of anyone's.
// It exists only where it is switched on (SPLITLY_SELFTEST=1) AND accounts
// are not configured: on a site with real people it cannot be turned on at
// all, whatever the variable says. Everywhere else its addresses are "not
// found", like any address that does not exist.

const GROUP = "demo-istanbul";
/** Nobody: the person a self-test address is made out to. */
const NOBODY = "00000000-0000-4000-8000-000000000000";

export const selfTestOn = () => process.env.SPLITLY_SELFTEST === "1" && !accountsConfigured() && serverEnv().sessionSecret.length >= 32;

const notFound = () =>
  new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** `path` is what follows /api/v1/, beginning with "selftest". */
export async function selfTest(request: Request, path: string[]): Promise<Response> {
  if (!selfTestOn() || request.method !== "GET") return notFound();
  const secret = serverEnv().sessionSecret;

  // selftest/link?format=pdf&locale=ru[&age=400]: an address for the demo group's report. `age` makes it as if it had
  // been issued that many seconds ago, to see an out-of-date one refused.
  if (path.length === 2 && path[1] === "link") {
    const params = new URL(request.url).searchParams;
    const locale = params.get("locale") ?? "ru";
    const report = checkReportAsk({
      format: params.get("format") ?? "pdf",
      sections: ["expenses", "debts", "payments"],
      period: "all",
      currency: null,
      day: new Date().toISOString().slice(0, 10),
    });
    const age = Number(params.get("age") ?? "0");
    if (!report || !isLocale(locale) || !Number.isFinite(age) || age < 0 || age > 86_400) return notFound();
    const ticket = issueTicket(NOBODY, { kind: "selftest", locale, report }, secret, Math.floor(Date.now() / 1000) - age);
    return Response.json(
      { url: `/api/v1/selftest/file/${ticket}`, goodForSeconds: TICKET_SECONDS - age },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // selftest/file/<ticket>: the file, if the address is as it was signed and still in date.
  if (path.length === 3 && path[1] === "file") {
    const ticket = readTicket(path[2], secret);
    const ask = ticket?.file as { kind?: unknown; locale?: unknown; report?: unknown } | undefined;
    const report = checkReportAsk(ask?.report);
    if (!ticket || ticket.userId !== NOBODY || ask?.kind !== "selftest" || !isLocale(ask.locale) || !report) return notFound();
    // The demo's own group, made in memory: nothing is read from or written to anywhere.
    const memory: Record<string, string> = {};
    const shelf: Shelf = {
      getItem: (key) => memory[key] ?? null,
      setItem: (key, value) => void (memory[key] = value),
      removeItem: (key) => void delete memory[key],
    };
    const group = await createDemoStore(shelf, ask.locale).getGroup(GROUP);
    if (!group) return notFound();
    return respond(await makeReport(group, report, getDictionary(ask.locale), ask.locale, fonts));
  }
  return notFound();
}
