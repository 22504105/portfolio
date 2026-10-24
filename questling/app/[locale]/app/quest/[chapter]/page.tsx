import { notFound } from "next/navigation";
import { QuestDetailsScreen } from "@/components/student/quest-details-screen";
import { findChapter } from "@/lib/content/campaigns";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.details.title);

export default async function Page({ params }: PageProps<"/[locale]/app/quest/[chapter]">) {
  const { chapter } = await params;
  if (!findChapter(chapter)) notFound();
  return <QuestDetailsScreen chapterId={chapter} />;
}
