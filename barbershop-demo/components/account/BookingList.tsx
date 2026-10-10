import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { BookingSummary } from "@/lib/account";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";

type BookingListProps = {
  bookings: BookingSummary[];
  empty: string;
  /** Who the row is about: a client sees the barber, a barber sees the client. */
  view: "client" | "barber";
  /** Buttons for one booking, at the end of its row. */
  actions?: (booking: BookingSummary) => ReactNode;
};

/** Bookings as ruled rows: when, who, what, and what can be done about it. */
export function BookingList({ bookings, empty, view, actions }: BookingListProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (bookings.length === 0) return <p className="type-body border-t border-line py-5 text-muted">{empty}</p>;

  return (
    <ul className="border-t border-line">
      {bookings.map((booking) => (
        <li key={booking.id} className="grid gap-x-6 gap-y-3 border-b border-line py-5 md:grid-cols-12 md:items-baseline">
          <div className="md:col-span-4">
            <p className="type-h3 normal-case">
              {formatDateTime(booking.startsAt, locale, { weekday: "short", day: "numeric", month: "long" })}
            </p>
            <p className="type-body tabular-nums text-muted">
              {formatDateTime(booking.startsAt, locale, { hour: "2-digit", minute: "2-digit" })} –{" "}
              {formatDateTime(booking.endsAt, locale, { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <div className="type-body md:col-span-5">
            <p>{booking.services.map((service) => service[locale]).join(" · ")}</p>
            {view === "client" ? (
              <p className="text-muted">
                {t("account.with", { barber: booking.barberName })} · {formatMoney(booking.totalPriceCents, locale)}
              </p>
            ) : (
              <p className="text-muted">
                {booking.customerName} · {t("barber.phone")}: {booking.customerPhone} ·{" "}
                {formatDuration(booking.totalDurationMinutes, locale)}
              </p>
            )}
            {booking.status !== "confirmed" && <p className="type-eyebrow mt-2 text-muted">{t(`booking.status.${booking.status}`)}</p>}
          </div>

          {actions && <div className="flex flex-wrap gap-2 md:col-span-3 md:justify-end">{actions(booking)}</div>}
        </li>
      ))}
    </ul>
  );
}
