import { notFound } from "next/navigation";
import { PlayScreen } from "@/components/student/play-screen";
import { campaignById } from "@/lib/content/campaigns";

// A teacher's campaign ("t-…") is known only to the student's own data: the screen checks it.
const TEACHER_CAMPAIGN = /^t-[a-z0-9-]{4,60}$/;
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.player.title);

export default async function Page({ params }: PageProps<"/[locale]/app/play/[campaign]">) {
  const { campaign } = await params;
  if (!campaignById.has(campaign) && !TEACHER_CAMPAIGN.test(campaign)) notFound();
  return <PlayScreen campaignId={campaign} />;
}
