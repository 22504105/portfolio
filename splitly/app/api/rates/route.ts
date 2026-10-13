import { NextResponse } from "next/server";
import { rateQuery, readOffer } from "@/lib/money/auto-rate";

// One exchange rate, offered from the European Central Bank's daily table
// (lib/money/auto-rate.ts). The server asks, so that the page never talks to
// another site, and keeps each answer for twelve hours: the table changes
// once a working day. It reads nothing of Splitly's and needs no session:
// the same public figure for everyone. When the source has no rate for the
// pair or cannot be reached, the answer says so and the person types one.

const KEEP_SECONDS = 12 * 60 * 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const [from, to] = [params.get("from"), params.get("to")];
  const query = rateQuery(from, to);
  if (!query) return NextResponse.json({ error: "unavailable" }, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  try {
    const response = await fetch(query, { next: { revalidate: KEEP_SECONDS }, signal: AbortSignal.timeout(6000) });
    const offer = response.ok ? readOffer(await response.json(), from!, to!) : null;
    if (!offer) return NextResponse.json({ error: "unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(offer, { headers: { "Cache-Control": `public, max-age=3600, s-maxage=${KEEP_SECONDS}` } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
