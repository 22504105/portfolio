import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverviewPage } from "@/components/pages/OverviewPage";
import { EmptyWorkspace } from "@/components/workspace/EmptyWorkspace";
import { appWorkspace } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";
import { loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Overview" };

export default async function Page({ searchParams }: PageProps<"/app/overview">) {
  const context = await appWorkspace();
  if (!context) redirect("/app/welcome");
  const messages = getMessages();
  if (context.dataset.orders.length === 0) return <EmptyWorkspace title={messages.nav.overview} messages={messages} />;
  return <OverviewPage page={loadPage(context, "overview", await searchParams)} messages={messages} />;
}
