"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, switchLocalePath, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type LocaleSwitchProps = { locale: Locale; labels: Dictionary["language"]; className?: string };

/** The same screen in the other language. The language is part of the address, so this is a pair of links. */
export function LocaleSwitch({ locale, labels, className }: LocaleSwitchProps) {
  const pathname = usePathname();
  return (
    <nav aria-label={labels.label} className={cn("rounded-control border-field bg-surface inline-flex border p-1", className)}>
      {LOCALES.map((option) => (
        <Link
          key={option}
          href={switchLocalePath(pathname, option)}
          hrefLang={option}
          lang={option}
          aria-current={option === locale ? "true" : undefined}
          aria-label={labels[option]}
          className={cn(
            "type-small inline-flex h-9 min-w-11 items-center justify-center rounded-[9px] px-2.5 font-semibold uppercase transition-colors",
            option === locale ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink",
          )}
        >
          {option}
        </Link>
      ))}
    </nav>
  );
}
