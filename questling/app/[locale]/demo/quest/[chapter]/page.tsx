import { notFound } from "next/navigation";
import { QuestDetailsScreen } from "@/components/student/quest-details-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.details.title);

// The chapter is found among the student's campaigns on the screen; ?c= names a teacher's campaign.
export default async function Page({ params, searchParams }: PageProps<"/[locale]/demo/quest/[chapter]">) {
  const { chapter } = await params;
  const { c } = await searchParams;
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(chapter)) notFound();
  return <QuestDetailsScreen chapterId={chapter} campaignId={typeof c === "string" ? c : undefined} />;
}
