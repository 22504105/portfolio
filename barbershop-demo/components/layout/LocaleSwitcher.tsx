"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const SHORT = { en: "shortEn", ru: "shortRu" } as const satisfies Record<Locale, string>;

// Links, not buttons: each goes to the same page in the other language, works
// without JavaScript and can be opened in a new tab.
export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("switcherLabel")}>
      <ul className="flex items-center">
        {routing.locales.map((locale) => {
          const active = locale === current;
          return (
            <li key={locale} className="border-l border-line first:border-l-0">
              <Link
                href={pathname}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                aria-current={active ? "true" : undefined}
                aria-label={t(active ? "current" : "switchTo", { language: t(locale) })}
                className="type-label inline-flex h-11 min-w-11 items-center justify-center px-3 text-muted transition-colors duration-(--duration-fast) hover:text-fg aria-[current]:text-fg"
              >
                {t(SHORT[locale])}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
