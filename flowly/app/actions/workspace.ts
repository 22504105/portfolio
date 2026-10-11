"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CURRENCIES, isTimezone } from "@/lib/settings/options";
import { createSupabaseServerClient, currentUser } from "@/lib/supabase/server";

export type WorkspaceState = { error?: "invalid" | "exists" | "unavailable" };

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  currency: z.enum(CURRENCIES.map((currency) => currency.code) as [string, ...string[]]),
  timezone: z.string().refine(isTimezone),
});

/** Creates the signed-in user's workspace: once, when they first arrive. */
export async function createWorkspace(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unavailable" };

  // The owner is the session's user, never a value from the form; row level security checks it again.
  const { error } = await supabase
    .from("workspaces")
    .insert({ owner_user_id: user.id, name: parsed.data.name, currency_code: parsed.data.currency, timezone: parsed.data.timezone });
  if (error && error.code !== "23505") return { error: "unavailable" };

  revalidatePath("/app", "layout");
  redirect("/app/imports");
}
