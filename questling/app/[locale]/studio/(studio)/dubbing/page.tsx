import { DubbingScreen } from "@/components/studio/dubbing-screen";
import { studioMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = studioMetadata("live", (t) => t.dubbing.title);

export default function Page() {
  return <DubbingScreen />;
}
