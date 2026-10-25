import { Suspense } from "react";
import { BuilderScreen } from "@/components/studio/builder-screen";
import { studioMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = studioMetadata("live", (t) => t.builder.title);

export default function Page() {
  return (
    <Suspense>
      <BuilderScreen />
    </Suspense>
  );
}
