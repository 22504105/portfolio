import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { getMessages } from "@/lib/i18n";
import { demoWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: { default: "Demo workspace", template: "%s · Flowly demo" } };

// The public demo. It reads no database and needs no configuration: its data
// is generated from a fixed seed (lib/demo/dataset.ts) and it changes nothing.
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  const { root, dataset, calendar } = demoWorkspace();
  return (
    <AppShell root={root} workspaceName={dataset.workspace.name} calendar={calendar} messages={getMessages()}>
      {children}
    </AppShell>
  );
}
