import type { routing } from "@/i18n/routing";
import type messages from "@/messages/en.json";

// Makes locale names and message keys compile-time checked. English is the
// reference catalog; tests/messages.test.ts keeps Russian in step with it.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
