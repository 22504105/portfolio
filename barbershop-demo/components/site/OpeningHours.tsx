import { useLocale, useTranslations } from "next-intl";
import { openingHours, type Barber } from "@/lib/catalog";
import { formatWeekday } from "@/lib/format";

/** The shop's hours for each day of the week, worked out from the barbers' hours. */
export function OpeningHours({ barbers }: { barbers: Barber[] }) {
  const t = useTranslations("common");
  const locale = useLocale();

  return (
    <dl className="type-body border-t border-line">
      {openingHours(barbers).map(({ weekday, open, close }) => (
        <div key={weekday} className="flex items-baseline justify-between gap-6 border-b border-line py-3">
          <dt>{formatWeekday(weekday, locale)}</dt>
          <dd className={open ? "tabular-nums" : "text-muted"}>{open ? `${open} – ${close}` : t("closed")}</dd>
        </div>
      ))}
    </dl>
  );
}
