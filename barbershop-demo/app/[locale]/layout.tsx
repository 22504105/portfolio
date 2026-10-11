import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ServiceWorker } from "@/components/layout/ServiceWorker";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { routing } from "@/i18n/routing";
import { getCatalog } from "@/lib/catalog/server";
import { displayFont, sansFont } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: { default: t("title"), template: "%s — CUT&CO" },
    description: t("description"),
    applicationName: "CUT&CO",
    appleWebApp: { capable: true, title: "CUT&CO", statusBarStyle: "black-translucent" },
    alternates: {
      languages: Object.fromEntries(routing.locales.map((language) => [language, `/${language}`])),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0c0c0b",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Lets the pages below be rendered statically.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  const { shop } = await getCatalog();

  return (
    <html lang={locale} className={`${displayFont.variable} ${sansFont.variable}`}>
      <body className="type-body flex min-h-dvh flex-col bg-bg text-fg">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="type-label sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-bone focus:px-4 focus:py-3 focus:text-ink"
          >
            {t("skipToContent")}
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter shop={shop} year={new Date().getFullYear()} />
          <ServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
