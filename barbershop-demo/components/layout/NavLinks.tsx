"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { NAVIGATION } from "@/lib/navigation";

type NavLinksProps = {
  /** Styles each link; the current page also gets `aria-current="page"`. */
  linkClassName: string;
  className?: string;
  onNavigate?: () => void;
};

/** The site's pages as a list of links, with the current one marked. */
export function NavLinks({ linkClassName, className, onNavigate }: NavLinksProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <ul className={className}>
      {NAVIGATION.map(({ key, href }) => (
        <li key={key}>
          <Link
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={linkClassName}
            onClick={onNavigate}
          >
            {t(key)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
