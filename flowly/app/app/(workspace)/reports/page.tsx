import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportsPage } from "@/components/pages/ReportsPage";
import { EmptyWorkspace } from "@/components/workspace/EmptyWorkspace";
import { appWorkspace } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";
import { loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Reports" };

export default async function Page({ searchParams }: PageProps<"/app/reports">) {
  const context = await appWorkspace();
  if (!context) redirect("/app/welcome");
  const messages = getMessages();
  if (context.dataset.orders.length === 0) return <EmptyWorkspace title={messages.nav.reports} messages={messages} />;
  return <ReportsPage page={loadPage(context, "reports", await searchParams)} messages={messages} />;
}
