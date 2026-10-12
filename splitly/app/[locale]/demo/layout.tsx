import type { Metadata } from "next";
import { DemoProvider } from "@/components/app/AppProvider";
import { AppFrame } from "@/components/shell/AppFrame";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false } };

// The browser demo: the app itself on invented data. It never reads or writes
// a real person's records and never calls the server: its data lives in the
// visitor's own browser.
export default async function DemoLayout({ children, params }: LayoutProps<"/[locale]/demo">) {
  const { locale, dictionary } = await pageLocale(params);
  return (
    <AppFrame locale={locale} dictionary={dictionary} base={`/${locale}/demo`} demo>
      <DemoProvider locale={locale} dictionary={dictionary}>
        {children}
      </DemoProvider>
    </AppFrame>
  );
}
