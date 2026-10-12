import { NextResponse } from "next/server";

// The smallest possible server endpoint: proof that server code runs where the
// site is hosted, and something for an uptime check to call. It reads nothing
// secret and says nothing about the machine beyond what is below.

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "splitly",
      stage: 4,
      // Where the code is running, as the host reports it: "iad1" and the like on Vercel, absent locally.
      region: process.env.VERCEL_REGION ?? null,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
