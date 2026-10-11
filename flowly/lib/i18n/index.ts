import { en, type Messages } from "./en";

// English is the only language written so far. To add Russian: create ru.ts
// exporting an object of type `Messages`, add it here, and choose the locale
// per request (a cookie or the Accept-Language header). Nothing else in the
// application holds interface text, and numbers, money and dates already take
// a locale (lib/money.ts, lib/time.ts).

export const locales = { en } satisfies Record<string, Messages>;
export type Locale = keyof typeof locales;
export const defaultLocale: Locale = "en";

export function getMessages(locale: Locale = defaultLocale): Messages {
  return locales[locale];
}

/** Fills {placeholders} in a message: fill("Up {n}%", { n: 4 }) → "Up 4%". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export type { Messages };
