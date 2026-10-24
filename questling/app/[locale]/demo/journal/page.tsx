import { JournalScreen } from "@/components/student/journal-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.journal.title);

export default function Page() {
  return <JournalScreen />;
}
