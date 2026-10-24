import { WelcomeScreen } from "@/components/student/welcome-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("demo", (t) => t.welcome.title);

export default function Page() {
  return <WelcomeScreen />;
}
