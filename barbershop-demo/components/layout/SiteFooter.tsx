import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Shop } from "@/lib/catalog";
import { BOOK_HREF, NAVIGATION } from "@/lib/navigation";
import { Container } from "./Container";

type SiteFooterProps = {
  shop: Shop;
  /** The current year, worked out by the layout when the page is rendered. */
  year: number;
};

const LINK = "inline-flex min-h-11 items-center text-fg transition-colors duration-(--duration-fast) hover:text-signal";

export function SiteFooter({ shop, year }: SiteFooterProps) {
  const t = useTranslations();

  return (
    <footer className="border-t border-line">
      <Container className="grid gap-12 py-14 md:grid-cols-12 md:py-20">
        <div className="md:col-span-5">
          <p className="type-h2">{t("brand.name")}</p>
          <p className="type-lead mt-4 max-w-xs text-muted">{t("brand.tagline")}</p>
        </div>

        <nav aria-label={t("nav.footer")} className="md:col-span-3">
          <ul className="type-body">
            {NAVIGATION.map(({ key, href }) => (
              <li key={key}>
                <Link href={href} className={LINK}>
                  {t(`nav.${key}`)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={BOOK_HREF} className={LINK}>
                {t("nav.bookAppointment")}
              </Link>
            </li>
            <li>
              {/* Leads to the sign-in page for anyone not signed in. */}
              <Link href="/account" className={LINK}>
                {t("nav.account")}
              </Link>
            </li>
          </ul>
        </nav>

        <address className="type-body not-italic text-muted md:col-span-4">
          <p className="text-fg">{shop.addressLine1}</p>
          <p>
            {shop.city} {shop.postcode}
          </p>
          <p className="mt-4">{shop.phone}</p>
          <p>{shop.email}</p>
        </address>
      </Container>

      <Container className="type-small flex flex-col gap-4 border-t border-line py-8 text-muted md:flex-row md:items-start md:justify-between">
        <p>
          {t("footer.rights", { year })} · {t("footer.pricesNote")}
        </p>
        {/* CUT&CO is fictional. The disclosure is on every page. */}
        <p className="max-w-xl text-fg">{t("brand.conceptLong")}</p>
      </Container>
    </footer>
  );
}
