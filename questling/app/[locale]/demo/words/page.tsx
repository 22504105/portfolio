import { WordsScreen } from "@/components/student/words-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.words.title);

export default function Page() {
  return <WordsScreen />;
}
