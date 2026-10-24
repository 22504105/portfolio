import { ProfileScreen } from "@/components/student/profile-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.profile.title);

export default function Page() {
  return <ProfileScreen />;
}
