import { HomeScreen } from "@/components/student/home-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("app", (t) => t.home.title);

export default function Page() {
  return <HomeScreen />;
}
