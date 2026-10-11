"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/data/workspace";
import { CURRENCIES, isTimezone } from "@/lib/settings/options";
import { createSupabaseServerClient, currentUser } from "@/lib/supabase/server";

// Changing and leaving a workspace. Every action starts from the session: the
// workspace is the signed-in user's own, never one named by the form.

export type SettingsState = { error?: "invalid" | "currency" | "unavailable" | "confirm"; done?: "saved" | "data_deleted" };

const workspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  currency: z.enum(CURRENCIES.map((currency) => currency.code) as [string, ...string[]]),
  timezone: z.string().refine(isTimezone),
});

/** What the user must type to confirm something irreversible: compared exactly, apart from surrounding spaces. */
const matches = (typed: FormDataEntryValue | null, expected: string) => typeof typed === "string" && typed.trim() === expected.trim();

export async function updateWorkspace(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const workspace = await loadWorkspace();
  const supabase = await createSupabaseServerClient();
  if (!workspace || !supabase) return { error: "unavailable" };

  const parsed = workspaceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };

  const { error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name, currency_code: parsed.data.currency, timezone: parsed.data.timezone })
    .eq("id", workspace.id);
  // The database refuses a new currency while orders exist: they are tied to the workspace's currency.
  if (error) return { error: error.code === "23503" ? "currency" : "unavailable" };

  revalidatePath("/app", "layout");
  return { done: "saved" };
}

export async function deleteWorkspaceData(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const workspace = await loadWorkspace();
  const supabase = await createSupabaseServerClient();
  if (!workspace || !supabase) return { error: "unavailable" };
  if (!matches(form.get("confirm"), workspace.name)) return { error: "confirm" };

  const { error } = await supabase.rpc("delete_workspace_data");
  if (error) return { error: "unavailable" };

  revalidatePath("/app", "layout");
  return { done: "data_deleted" };
}

export async function deleteAccount(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unavailable" };
  if (!matches(form.get("confirm"), user.email)) return { error: "confirm" };

  // The database function deletes the account that is calling it and no other.
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "unavailable" };

  // The session now belongs to nobody; clear its cookies. The account is already gone if this fails.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  revalidatePath("/", "layout");
  redirect("/");
}
