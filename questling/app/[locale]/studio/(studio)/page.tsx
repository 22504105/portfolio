import { DashboardScreen } from "@/components/studio/dashboard-screen";
import { studioMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = studioMetadata("live", (t) => t.dashboard.title);

export default function Page() {
  return <DashboardScreen />;
}
