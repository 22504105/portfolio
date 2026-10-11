import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImportsPage } from "@/components/pages/ImportsPage";
import { appWorkspace, loadBatches } from "@/lib/data/workspace";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: "Imports" };

export default async function Page() {
  const context = await appWorkspace();
  if (!context) redirect("/app/welcome");
  return <ImportsPage context={context} messages={getMessages()} batches={await loadBatches()} />;
}
