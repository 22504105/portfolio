import { notFound } from "next/navigation";
import { LiveStudioProvider } from "@/components/studio/studio-providers";
import { isLocale } from "@/lib/i18n";

// The signed-in Teacher Studio: the teacher's session (from /studio/login) and everything from the server.
export default async function StudioLayout({ children, params }: LayoutProps<"/[locale]/studio">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LiveStudioProvider locale={locale}>{children}</LiveStudioProvider>;
}
