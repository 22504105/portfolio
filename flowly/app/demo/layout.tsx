import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { DEMO_DEFAULT_RANGE, demoDataset } from "@/lib/demo/dataset";
import { getMessages } from "@/lib/i18n";
import { formatRange } from "@/lib/time";

export const metadata: Metadata = { title: { default: "Demo workspace", template: "%s · Flowly demo" } };

// The public demo. It reads no database and needs no configuration: its data
// is generated from a fixed seed (lib/demo/dataset.ts) and it changes nothing.
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <AppShell
      root="/demo"
      workspaceName={demoDataset().workspace.name}
      periodLabel={formatRange(DEMO_DEFAULT_RANGE)}
      messages={getMessages()}
    >
      {children}
    </AppShell>
  );
}
