import type { Metadata } from "next";
import { OverviewPage } from "@/components/pages/OverviewPage";
import { getMessages } from "@/lib/i18n";
import { demoWorkspace, loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Overview" };

export default async function Page({ searchParams }: PageProps<"/demo/overview">) {
  const page = loadPage(demoWorkspace(), "overview", await searchParams);
  return <OverviewPage page={page} messages={getMessages()} />;
}
