import { MapScreen } from "@/components/student/map-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.map.title);

export default function Page() {
  return <MapScreen />;
}
