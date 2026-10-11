import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalyticsPage } from "@/components/pages/AnalyticsPage";
import { EmptyWorkspace } from "@/components/workspace/EmptyWorkspace";
import { appWorkspace } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";
import { loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Analytics" };

export default async function Page({ searchParams }: PageProps<"/app/analytics">) {
  const context = await appWorkspace();
  if (!context) redirect("/app/welcome");
  const messages = getMessages();
  if (context.dataset.orders.length === 0) return <EmptyWorkspace title={messages.nav.analytics} messages={messages} />;
  return <AnalyticsPage page={loadPage(context, "analytics", await searchParams)} messages={messages} />;
}
