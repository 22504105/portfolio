import { notFound } from "next/navigation";
import { QuestRunner } from "@/components/student/quest-runner";
import { quickQuestById } from "@/lib/content/quick-quests";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.quests.title);

export default async function Page({ params }: PageProps<"/[locale]/app/quests/[quest]">) {
  const { quest } = await params;
  if (!quickQuestById.has(quest)) notFound();
  return <QuestRunner questId={quest} />;
}
