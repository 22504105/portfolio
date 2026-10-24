import { DiscoveryScreen } from "@/components/student/discovery-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.discovery.title);

export default function Page() {
  return <DiscoveryScreen />;
}
