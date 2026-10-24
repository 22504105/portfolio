import { notFound } from "next/navigation";
import { LiveProvider } from "@/components/student/live-provider";
import { isLocale } from "@/lib/i18n";

// The real student app: opened from Telegram, signed in from Telegram's signed sign-in data,
// progress kept on the server. Outside Telegram it says so and offers the demo.
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]/app">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LiveProvider locale={locale}>{children}</LiveProvider>;
}
