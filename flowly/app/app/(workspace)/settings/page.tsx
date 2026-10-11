import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { appWorkspace, loadBatches } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const context = await appWorkspace();
  if (!context) redirect("/app/welcome");
  return <SettingsPage context={context} messages={getMessages()} account={{ email: user.email }} batches={(await loadBatches()).length} />;
}
