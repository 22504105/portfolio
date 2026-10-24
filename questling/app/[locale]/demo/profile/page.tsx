import { ProfileScreen } from "@/components/student/profile-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.profile.title);

export default function Page() {
  return <ProfileScreen />;
}
