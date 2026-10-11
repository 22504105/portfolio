import { defineRouting } from "next-intl/routing";

// Every page lives under /en or /ru, so a link always says which language it
// is in — email links included. A first visit to "/" is sent to the visitor's
// language if it is one of ours, to English otherwise, and the choice is then
// remembered in a cookie.
export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "always",
  // A year, so the choice outlives the browser session. The cookie holds a
  // language code and nothing about the visitor.
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
