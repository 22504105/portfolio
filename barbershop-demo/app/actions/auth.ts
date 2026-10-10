"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getSessionUser, homeFor, linkCustomer, safeNext } from "@/lib/auth";
import { allowed } from "@/lib/booking/store";
import { throttleKey } from "@/lib/booking/tokens";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Sign-in, sign-up and profile. Forms post here; each action answers with a
// code the form turns into a message, and never with the provider's own text.

export type AuthState = { error?: "invalid" | "credentials" | "throttled" | "weak" | "failed"; done?: boolean };

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const password = z.string().min(8).max(200);
const localeOf = (value: FormDataEntryValue | null): Locale => (hasLocale(routing.locales, value) ? value : routing.defaultLocale);

async function clientAddress(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form.get("locale"));
  const parsed = z.object({ email, password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "credentials" };

  // Slows down guessing: by address and by the account aimed at.
  const [byAddress, byEmail] = await Promise.all([
    allowed(throttleKey("signin:ip", await clientAddress()), 20, 600),
    allowed(throttleKey("signin:email", parsed.data.email), 10, 600),
  ]);
  if (!byAddress || !byEmail) return { error: "throttled" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // One answer for a wrong password, an unknown address and an unconfirmed one.
  if (error || !data.user) return { error: "credentials" };

  await linkCustomer(data.user.id);
  const user = await getSessionUser();
  return redirect({ href: safeNext(form.get("next"), user ? homeFor(user) : "/account"), locale });
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form.get("locale"));
  const parsed = z
    .object({ name: z.string().trim().min(2).max(80), email, password })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues.some((issue) => issue.path[0] === "password") ? "weak" : "invalid" };
  }
  if (!(await allowed(throttleKey("signup:ip", await clientAddress()), 5, 3600))) return { error: "throttled" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the trigger that creates the profile. A role put here would be ignored.
      data: { full_name: parsed.data.name, locale },
      emailRedirectTo: `${getServerEnv().APP_URL}/${locale}/auth/callback`,
    },
  });
  if (error) return { error: error.code === "weak_password" ? "weak" : "failed" };

  // The same answer whether or not the address already has an account.
  return { done: true };
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form.get("locale"));
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "invalid" };
  if (!(await allowed(throttleKey("reset:ip", await clientAddress()), 5, 3600))) return { error: "throttled" };

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getServerEnv().APP_URL}/${locale}/auth/callback?next=/account/password`,
  });
  // Always "sent": the form does not say which addresses have accounts.
  return { done: true };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = password.safeParse(form.get("password"));
  if (!parsed.success) return { error: "weak" };
  if (!(await getSessionUser())) return { error: "failed" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.code === "weak_password" || error.code === "same_password" ? "weak" : "failed" };
  return { done: true };
}

export async function updateProfile(_: AuthState, form: FormData): Promise<AuthState> {
  const user = await getSessionUser();
  if (!user) return { error: "failed" };

  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().max(40).regex(/^[\d\s+\-().]*$/),
      language: z.enum(routing.locales),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };

  // The role is not among the columns written, whatever the form contains.
  await db().query("update public.profiles set full_name = $2, phone = nullif($3, ''), locale = $4 where id = $1", [
    user.id,
    parsed.data.name,
    parsed.data.phone,
    parsed.data.language,
  ]);
  revalidatePath("/[locale]/account", "page");
  return { done: true };
}

export async function signOut(form: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect({ href: "/", locale: localeOf(form.get("locale")) });
}
