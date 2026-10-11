"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Accounts. Passwords go straight to Supabase Auth and are never stored or
// logged here. Answers never say whether an email address has an account.

export type AuthState = {
  error?: "invalid" | "credentials" | "weak" | "unavailable" | "rate" | "mismatch";
  notice?: "check_email" | "reset_sent" | "updated";
  /** The address that was typed, handed back so the form can keep it after an error. Never the password. */
  email?: string;
};

/** What was typed in the email field, to give back with an error. */
const typed = (form: FormData) => String(form.get("email") ?? "").slice(0, 320);

const email = z.string().trim().toLowerCase().pipe(z.email().max(320));
const password = z.string().min(8).max(200);

/** The site's own address, for links in emails. Taken from the request, as the platform reports it. */
async function origin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

const failure = (status: number | undefined): AuthState => ({ error: status === 429 ? "rate" : "unavailable" });

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid", email: typed(form) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unavailable", email: typed(form) };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ...(error.status === 400 ? { error: "credentials" as const } : failure(error.status)), email: typed(form) };

  revalidatePath("/app", "layout");
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password }).safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: form.get("password") && String(form.get("password")).length < 8 ? "weak" : "invalid", email: typed(form) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unavailable", email: typed(form) };

  const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: `${await origin()}/auth/callback` } });
  if (error) {
    if (error.code === "weak_password") return { error: "weak", email: typed(form) };
    // Supabase refuses addresses it can tell are not real (a domain with no mail server, for one).
    if (error.code === "email_address_invalid") return { error: "invalid", email: typed(form) };
    // An address that is already registered gets the same answer as a new one.
    if (error.code !== "user_already_exists") return { ...failure(error.status), email: typed(form) };
  }
  // With email confirmation switched off there is a session at once. With it
  // on, or for an address that already has an account, there is none: the
  // answer is the same, and it reveals nothing.
  if (!data?.session) return { notice: "check_email" };

  revalidatePath("/app", "layout");
  redirect("/app/welcome");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  revalidatePath("/app", "layout");
  redirect("/login");
}

export async function requestReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unavailable" };

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await origin()}/auth/callback?next=/update-password`,
  });
  if (error?.status === 429) return { error: "rate" };
  // Sent or not, the answer is the same.
  return { notice: "reset_sent" };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ password, confirm: z.string() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "weak" };
  if (parsed.data.password !== parsed.data.confirm) return { error: "mismatch" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unavailable" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return error.code === "weak_password" || error.code === "same_password" ? { error: "weak" } : failure(error.status);
  return { notice: "updated" };
}
