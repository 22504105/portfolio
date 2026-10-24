import { SettingsScreen } from "@/components/student/settings-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.settings.title);

export default function Page() {
  return <SettingsScreen />;
}
