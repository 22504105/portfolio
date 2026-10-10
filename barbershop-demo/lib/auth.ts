import "server-only";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { db } from "./db";
import { isAuthConfigured, isDatabaseConfigured } from "./env";
import { createSupabaseServerClient } from "./supabase/server";

export type Role = "client" | "barber" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  /** From the database, never from the session: a role cannot be claimed. */
  role: Role;
  /** The barber profile of this account, when it is an active barber's. */
  barberId: string | null;
  name: string | null;
  phone: string | null;
  locale: Locale;
};

/** Whether accounts can work at all: they need both Supabase Auth and the database. */
export const accountsAvailable = () => isAuthConfigured() && isDatabaseConfigured();

/**
 * The signed-in user, or null. The session is checked with the auth server on
 * every request (`getUser`, not the unverified cookie), and the role is read
 * from the profile each time, so a demotion takes effect at once.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!accountsAvailable()) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return null;

  const { rows } = await db().query(
    `select p.role, p.full_name, p.phone, p.locale,
            (select b.id from public.barbers b where b.profile_id = p.id and b.is_active) as barber_id
     from public.profiles p where p.id = $1`,
    [data.user.id],
  );
  const profile = rows[0];
  if (!profile) return null;

  return {
    id: data.user.id,
    email: data.user.email,
    role: profile.role,
    // A barber's account without an active barber profile has no calendar.
    barberId: profile.role === "barber" ? profile.barber_id : null,
    name: profile.full_name,
    phone: profile.phone,
    locale: profile.locale,
  };
});

/** Where each role lands after signing in. */
export function homeFor(user: SessionUser): string {
  return user.role === "barber" && user.barberId ? "/barber" : "/account";
}

/**
 * The signed-in user, for pages that need one. Anyone else is sent to the
 * sign-in page; a signed-in user of the wrong role is sent to their own home,
 * and is told nothing about the page they asked for.
 */
export async function requireUser(locale: Locale, next: string, roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) return redirect({ href: { pathname: "/login", query: { next } }, locale });
  if (roles && !roles.includes(user.role)) return redirect({ href: homeFor(user), locale });
  return user;
}

/** Ties the account to the customer record of its confirmed address. Safe to repeat. */
export async function linkCustomer(userId: string): Promise<void> {
  await db().query("select public.link_customer_account($1)", [userId]);
}

/** A path inside the site, or the fallback: never somewhere a link could send a user away to. */
export function safeNext(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\/[A-Za-z0-9/_-]*$/.test(value) && !value.startsWith("//") ? value : fallback;
}
