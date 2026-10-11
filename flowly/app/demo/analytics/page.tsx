import type { Metadata } from "next";
import { AnalyticsPage } from "@/components/pages/AnalyticsPage";
import { getMessages } from "@/lib/i18n";
import { demoWorkspace, loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Analytics" };

export default async function Page({ searchParams }: PageProps<"/demo/analytics">) {
  const page = loadPage(demoWorkspace(), "analytics", await searchParams);
  return <AnalyticsPage page={page} messages={getMessages()} />;
}
