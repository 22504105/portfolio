import { RewardsScreen } from "@/components/student/rewards-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.rewards.title);

export default function Page() {
  return <RewardsScreen />;
}
