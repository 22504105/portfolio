import type { Metadata } from "next";
import { AppFrame } from "@/components/shell/AppFrame";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false } };

// The browser demo: the app itself on invented data. It never reads or writes
// a real user's records; from stage 2 its data lives in the visitor's browser.
export default async function DemoLayout({ children, params }: LayoutProps<"/[locale]/demo">) {
  const { locale, dictionary } = await pageLocale(params);
  return (
    <AppFrame locale={locale} dictionary={dictionary} base={`/${locale}/demo`} demo>
      {children}
    </AppFrame>
  );
}
