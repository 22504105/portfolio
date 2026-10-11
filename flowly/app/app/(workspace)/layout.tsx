import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { appWorkspace } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";
import { accountsEnabled } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Workspace", template: "%s · Flowly" }, robots: { index: false } };

// A signed-in user's own workspace. Every page under here is checked: no
// session means the sign-in page, no workspace yet means setting one up. The
// data itself is guarded again by the database, row by row.
export default async function WorkspaceLayout({ children }: LayoutProps<"/app">) {
  if (!accountsEnabled()) redirect("/login");
  const user = await currentUser();
  if (!user) redirect("/login");
  const context = await appWorkspace();
  if (!context) redirect("/app/welcome");

  return (
    <AppShell
      root="/app"
      workspaceName={context.dataset.workspace.name}
      calendar={context.calendar}
      messages={getMessages()}
      account={{ email: user.email }}
    >
      {children}
    </AppShell>
  );
}
