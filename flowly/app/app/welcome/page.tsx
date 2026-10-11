import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth/AuthPage";
import { WelcomeForm } from "@/components/workspace/WelcomeForm";
import { loadWorkspace } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";
import { CURRENCIES, timezones } from "@/lib/settings/options";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false } };

export default async function WelcomePage() {
  const messages = getMessages();
  if (!(await currentUser())) redirect("/login?next=/app/welcome");
  // One workspace per account: with one already made, there is nothing to set up.
  if (await loadWorkspace()) redirect("/app/overview");

  return (
    <AuthPage title={messages.welcome.title}>
      <p className="text-ink-muted -mt-2 mb-6 text-[0.9375rem] leading-relaxed">{messages.welcome.lead}</p>
      <WelcomeForm labels={messages.welcome} working={messages.auth.working} currencies={CURRENCIES} timezones={timezones()} />
    </AuthPage>
  );
}
