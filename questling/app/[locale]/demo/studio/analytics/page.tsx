import { Suspense } from "react";
import { AnalyticsScreen } from "@/components/studio/analytics-screen";
import { studioMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = studioMetadata("demo", (t) => t.analytics.title);

export default function Page() {
  return (
    <Suspense>
      <AnalyticsScreen />
    </Suspense>
  );
}
