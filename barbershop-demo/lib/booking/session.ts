import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { MANAGE_SESSION_COOKIE, MANAGE_SESSION_SECONDS, openManageSession, sealManageSession } from "./tokens";

// The management session cookie, for server components, actions and route
// handlers. See ./tokens.ts for what is inside it.

/** Starts a management session for a booking. Only where cookies can be written. */
export async function openSession(bookingId: string): Promise<void> {
  (await cookies()).set(MANAGE_SESSION_COOKIE, sealManageSession(bookingId, getServerEnv().SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MANAGE_SESSION_SECONDS,
  });
}

/** The booking the caller holds a management session for, if any. */
export async function sessionBookingId(): Promise<string | null> {
  return openManageSession((await cookies()).get(MANAGE_SESSION_COOKIE)?.value, getServerEnv().SESSION_SECRET);
}
