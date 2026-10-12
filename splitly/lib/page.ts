import { notFound } from "next/navigation";
import { getDictionary, isLocale, type Dictionary, type Locale } from "@/lib/i18n";

/** The language of a page and its words, from the address. An unknown language is a page that does not exist. */
export async function pageLocale(params: Promise<{ locale: string }>): Promise<{ locale: Locale; dictionary: Dictionary }> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, dictionary: getDictionary(locale) };
}
