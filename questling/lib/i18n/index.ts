import { en } from "./en";
import { ru, type Dictionary } from "./ru";

// The interface speaks Russian and English (owner's decision, 2026-10-24); the story content stays
// English, since English is what is being learnt. The language is the first part of every address
// (/ru/…, /en/…): that works inside Telegram, where cookies set by an embedded page may not survive,
// and it makes any screen linkable in either language. The switch is on the settings screen.

export const LOCALES = ["ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";

const dictionaries: Record<Locale, Dictionary> = { ru, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Fills {placeholders}: fill("Улика {n}", { n: 2 }) → "Улика 2". An unknown placeholder is left as it is. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

/** "6 дней", "1 day": picks the plural form the language's rules call for and fills in {n}. */
export function plural(locale: Locale, n: number, forms: Record<"one" | "few" | "many" | "other", string>): string {
  const rule = new Intl.PluralRules(locale).select(n);
  const form = rule === "one" || rule === "few" || rule === "many" ? forms[rule] : forms.other;
  return fill(form, { n });
}

/**
 * The language to offer someone who arrives without one in the address: the first of
 * theirs that Questling speaks. `preferences` is an Accept-Language header
 * ("ru-RU,ru;q=0.9,en;q=0.8") or a Telegram language code ("ru").
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
