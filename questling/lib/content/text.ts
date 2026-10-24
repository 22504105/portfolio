import type { Locale } from "@/lib/i18n";

// Content written for both interface languages. English learning material (clues,
// answers, example sentences) is a plain string: it is the same in both.
export type Text = { ru: string; en: string };

export const tr = (text: Text, locale: Locale): string => text[locale];
