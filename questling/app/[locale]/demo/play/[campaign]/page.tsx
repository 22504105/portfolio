import { notFound } from "next/navigation";
import { PlayScreen } from "@/components/student/play-screen";
import { campaignById } from "@/lib/content/campaigns";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.player.title);

export default async function Page({ params }: PageProps<"/[locale]/demo/play/[campaign]">) {
  const { campaign } = await params;
  if (!campaignById.has(campaign)) notFound();
  return <PlayScreen campaignId={campaign} />;
}
