import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Params = Promise<{ locale: string }>;

/** The pages that have their own title and description in the message catalog. */
export type PageKey = "services" | "barbers" | "gallery" | "about" | "contact" | "book";

/**
 * The first thing every page does: check the language in the address and tell
 * next-intl about it, which is what lets the page be rendered statically.
 */
export async function pageLocale(params: Params): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

/** Title, description and language alternates of an inner page. */
export async function pageMetadata(params: Params, page: PageKey, path: string): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t(`${page}.title`),
    description: t(`${page}.description`),
    alternates: {
      canonical: `/${locale}${path}`,
      languages: Object.fromEntries(routing.locales.map((language) => [language, `/${language}${path}`])),
    },
  };
}
