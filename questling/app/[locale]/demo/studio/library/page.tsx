import { LibraryScreen } from "@/components/studio/library-screen";
import { studioMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = studioMetadata("demo", (t) => t.library.title);

export default function Page() {
  return <LibraryScreen />;
}
