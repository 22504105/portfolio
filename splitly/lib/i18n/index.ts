import { en, type Dictionary } from "./en";
import { ru } from "./ru";

// Two languages, English and Russian. The language is the first part of every
// address (/en/…, /ru/…): that works inside Telegram, where cookies set by an
// embedded page may not survive, and makes any screen linkable in either language.

export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const dictionaries: Record<Locale, Dictionary> = { en, ru };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Fills {placeholders}: fill("Stage {n}", { n: 2 }) → "Stage 2". An unknown placeholder is left as it is. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

/**
 * The language to offer someone who arrives without one in the address: the
 * first of theirs that Splitly speaks. `preferences` is an Accept-Language
 * header ("ru-RU,ru;q=0.9,en;q=0.8") or a Telegram language code ("ru").
 */
export function pickLocale(preferences: string | null | undefined): Locale {
  if (!preferences) return DEFAULT_LOCALE;
  const ranked = preferences
    .split(",")
    .map((part) => {
      const [tag, quality] = part.trim().split(";q=");
      return { language: tag.toLowerCase().split("-")[0], weight: quality === undefined ? 1 : Number(quality) || 0 };
    })
    .sort((a, b) => b.weight - a.weight);
  for (const { language } of ranked) if (isLocale(language)) return language;
  return DEFAULT_LOCALE;
}

/** The same address in another language. */
export function switchLocalePath(pathname: string, locale: Locale): string {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) parts[1] = locale;
  else parts.splice(1, 0, locale);
  return parts.join("/") || `/${locale}`;
}

export type { Dictionary };
