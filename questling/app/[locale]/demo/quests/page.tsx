import { QuestsScreen } from "@/components/student/quests-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.quests.title);

export default function Page() {
  return <QuestsScreen />;
}
