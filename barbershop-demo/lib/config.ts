import type { Locale } from "@/i18n/routing";

/** The shop's time zone. Appointments are always shown and scheduled in it. */
export const BUSINESS_TIME_ZONE = "Europe/London";

/** The only currency. Amounts are integer cents everywhere. */
export const CURRENCY = "USD";

/** The regional format behind each interface language. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  ru: "ru-RU",
};
