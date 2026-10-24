import { WelcomeScreen } from "@/components/student/welcome-screen";
import { pageMetadata } from "@/lib/i18n/metadata";

// The address Telegram opens (the Mini App URL set in @BotFather): the welcome screen itself,
// not a redirect, since nothing below the sign-in gate renders until the student is signed in.
export const generateMetadata = pageMetadata("app", (t) => t.welcome.title);

export default function Page() {
  return <WelcomeScreen />;
}
