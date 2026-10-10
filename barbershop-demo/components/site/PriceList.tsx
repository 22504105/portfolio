import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/catalog";
import { formatDuration, formatMoney } from "@/lib/format";
import { BOOK_HREF } from "@/lib/navigation";

type PriceListProps = {
  services: Service[];
  /** The full list adds descriptions and a booking link to each row. */
  detailed?: boolean;
};

// The price list is a ruled table of rows, not a grid of cards: name on the
// left, time and price on the right, read like a menu.
export function PriceList({ services, detailed = false }: PriceListProps) {
  const t = useTranslations("services");
  const locale = useLocale();

  return (
    <ul className="border-t border-line">
      {services.map((service) => (
        <li
          key={service.id}
          className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2 border-b border-line py-5 md:grid-cols-12 md:py-6"
        >
          <div className="md:col-span-6">
            <h3 className="type-h3">{service.name[locale]}</h3>
            {detailed && <p className="type-body mt-2 max-w-md text-muted">{service.description[locale]}</p>}
          </div>

          <p className="type-h3 text-right tabular-nums md:order-last md:col-span-2">
            <span className="sr-only">{t("price")}: </span>
            {formatMoney(service.priceCents, locale)}
          </p>

          <p className="type-body text-muted max-md:col-span-2 md:col-span-2">
            <span className="sr-only">{t("duration")}: </span>
            {formatDuration(service.durationMinutes, locale)}
          </p>

          {detailed && (
            <p className="max-md:col-span-2 md:col-span-2">
              <Link
                href={{ pathname: BOOK_HREF, query: { service: service.slug } }}
                aria-label={t("bookService", { service: service.name[locale] })}
                className="type-label inline-flex min-h-11 items-center border-b border-fg transition-colors duration-(--duration-fast) hover:border-signal hover:text-signal"
              >
                {t("book")}
              </Link>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
