import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processDueJobs } from "@/lib/email/worker";
import { getServerEnv, isDatabaseConfigured } from "@/lib/env";

// Called by the scheduler every few minutes: expires stale holds and sends the
// emails that have come due, reminders among them. Safe to call as often as
// one likes and from several places at once; each job goes to one caller.

export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const secret = getServerEnv().CRON_SECRET;
  // Without a secret configured the endpoint is closed, not open.
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured() || !authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  // Counts only: no addresses, no content.
  return NextResponse.json(await processDueJobs(50));
}
