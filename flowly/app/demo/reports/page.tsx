import type { Metadata } from "next";
import { ReportsPage } from "@/components/pages/ReportsPage";
import { getMessages } from "@/lib/i18n";
import { demoWorkspace, loadPage } from "@/lib/workspace";

export const metadata: Metadata = { title: "Reports" };

export default async function Page({ searchParams }: PageProps<"/demo/reports">) {
  return <ReportsPage page={loadPage(demoWorkspace(), "reports", await searchParams)} messages={getMessages()} />;
}
