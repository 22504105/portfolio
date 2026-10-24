import { WardrobeScreen } from "@/components/student/wardrobe-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.wardrobe.title);

export default function Page() {
  return <WardrobeScreen />;
}
