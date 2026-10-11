import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { processDueJobs } from "@/lib/email/worker";
import { getServerEnv, isDatabaseConfigured } from "@/lib/env";

// Called by the scheduler every few minutes: expires stale holds, sends the
// emails that have come due, reminders among them, and clears out stale data. Safe to call as often as
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
  const report = await processDueJobs(50);
  // Unconfirmed holds older than thirty days, expired tokens, sent email jobs: see docs/security.md.
  const purged = (await db().query("select public.purge_stale_data(30) as result")).rows[0].result;
  // Counts only: no addresses, no content.
  return NextResponse.json({ ...report, purged });
}
