import { notFound } from "next/navigation";
import { QuestDetailsScreen } from "@/components/student/quest-details-screen";
import { chapterById } from "@/lib/content/campaign";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.details.title);

export default async function Page({ params }: PageProps<"/[locale]/app/quest/[chapter]">) {
  const { chapter } = await params;
  const found = chapterById.get(chapter);
  // A chapter whose story is not written yet (Gate 3) has no details to show.
  if (!found || found.nodes.length === 0) notFound();
  return <QuestDetailsScreen chapterId={found.id} />;
}
