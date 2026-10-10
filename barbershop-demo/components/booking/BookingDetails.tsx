import { useLocale, useTranslations } from "next-intl";
import type { BookingView } from "@/lib/booking/store";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";

/** One booking as a ruled list: when, who, what, how long, how much. */
export function BookingDetails({ booking }: { booking: BookingView }) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const row = "grid gap-1 border-b border-line py-4 sm:grid-cols-[9rem_1fr]";
  const label = "type-eyebrow pt-1 text-muted";

  return (
    <dl className="type-body border-t border-line">
      <div className={row}>
        <dt className={label}>{t("summary.when")}</dt>
        <dd>
          <span className="type-h3 block normal-case">
            {formatDateTime(booking.startsAt, locale, { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <span className="block tabular-nums">
            {formatDateTime(booking.startsAt, locale, { hour: "2-digit", minute: "2-digit" })} –{" "}
            {formatDateTime(booking.endsAt, locale, { hour: "2-digit", minute: "2-digit" })}
          </span>
        </dd>
      </div>
      <div className={row}>
        <dt className={label}>{t("summary.barber")}</dt>
        <dd>{booking.barber.name}</dd>
      </div>
      <div className={row}>
        <dt className={label}>{t("summary.services")}</dt>
        <dd>
          {booking.services.map((service) => (
            <span key={service.name.en} className="flex justify-between gap-4">
              <span>{service.name[locale]}</span>
              <span className="shrink-0 tabular-nums">{formatMoney(service.priceCents, locale)}</span>
            </span>
          ))}
        </dd>
      </div>
      <div className={row}>
        <dt className={label}>{t("summary.duration")}</dt>
        <dd className="tabular-nums">{formatDuration(booking.totalDurationMinutes, locale)}</dd>
      </div>
      <div className={row}>
        <dt className={label}>{t("summary.total")}</dt>
        <dd className="type-h3 tabular-nums">{formatMoney(booking.totalPriceCents, locale)}</dd>
      </div>
      <div className={row}>
        <dt className={label}>{t("held.reference")}</dt>
        <dd className="tabular-nums">{booking.reference}</dd>
      </div>
      <div className={row}>
        <dt className={label}>{t("manage.status")}</dt>
        <dd>{t(`status.${booking.status}`)}</dd>
      </div>
    </dl>
  );
}
