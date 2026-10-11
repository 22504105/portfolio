import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { BUSINESS_TIME_ZONE } from "@/lib/config";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Appointments are always shown in shop time, wherever the visitor is.
    timeZone: BUSINESS_TIME_ZONE,
  };
});
