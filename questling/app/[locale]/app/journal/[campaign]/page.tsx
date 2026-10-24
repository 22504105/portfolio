import { notFound } from "next/navigation";
import { JournalScreen } from "@/components/student/journal-screen";
import { campaignById } from "@/lib/content/campaigns";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.journal.title);

export default async function Page({ params }: PageProps<"/[locale]/app/journal/[campaign]">) {
  const { campaign } = await params;
  if (!campaignById.has(campaign)) notFound();
  return <JournalScreen campaignId={campaign} />;
}
