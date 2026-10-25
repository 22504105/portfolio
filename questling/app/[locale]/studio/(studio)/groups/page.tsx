import { Suspense } from "react";
import { GroupsScreen } from "@/components/studio/groups-screen";
import { studioMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = studioMetadata("live", (t) => t.groups.title);

export default function Page() {
  return (
    <Suspense>
      <GroupsScreen />
    </Suspense>
  );
}
