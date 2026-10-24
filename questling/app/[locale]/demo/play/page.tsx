import { PlayScreen } from "@/components/student/play-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.player.title);

export default function Page() {
  return <PlayScreen />;
}
