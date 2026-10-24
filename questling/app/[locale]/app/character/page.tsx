import { CharacterScreen } from "@/components/student/character-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.select.title);

export default function Page() {
  return <CharacterScreen />;
}
