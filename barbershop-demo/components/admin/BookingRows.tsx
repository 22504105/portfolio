import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminBooking } from "@/lib/admin/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Table, TD, TH } from "./parts";

type BookingRowsProps = {
  bookings: AdminBooking[];
  base: string;
  locale: "en" | "ru";
  empty: string;
  /** Leave the date out when every row is on the same day. */
  showDate?: boolean;
};

/** Bookings as a table: when, who, with whom, what, in what state, paid or not. */
export function BookingRows({ bookings, base, locale, empty, showDate = true }: BookingRowsProps) {
  const t = useTranslations();
  if (bookings.length === 0) return <p className="type-body border-t border-line py-5 text-muted">{empty}</p>;

  return (
    <Table caption={t("admin.bookings.title")}>
      <thead>
        <tr>
          <th scope="col" className={TH}>{t("admin.bookings.when")}</th>
          <th scope="col" className={TH}>{t("admin.bookings.client")}</th>
          <th scope="col" className={TH}>{t("admin.bookings.barber")}</th>
          <th scope="col" className={TH}>{t("admin.bookings.services")}</th>
          <th scope="col" className={TH}>{t("admin.bookings.status")}</th>
          <th scope="col" className={TH}>{t("admin.bookings.payment")}</th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((booking) => (
          <tr key={booking.id}>
            <td className={`${TD} whitespace-nowrap tabular-nums`}>
              <Link href={`${base}/bookings/${booking.id}`} className="underline underline-offset-4 transition-colors duration-(--duration-fast) hover:text-signal">
                {showDate && `${formatDateTime(booking.startsAt, locale, { day: "numeric", month: "short" })}, `}
                {formatDateTime(booking.startsAt, locale, { hour: "2-digit", minute: "2-digit" })}
              </Link>
            </td>
            <td className={TD}>
              {booking.customerName}
              <span className="block text-muted">{booking.customerPhone}</span>
            </td>
            <td className={TD}>{booking.barberName}</td>
            <td className={TD}>{booking.services.map((service) => service.name[locale]).join(", ")}</td>
            <td className={TD}>{t(`booking.status.${booking.status}`)}</td>
            <td className={`${TD} whitespace-nowrap tabular-nums`}>
              {booking.paidCents !== null
                ? t("admin.bookings.paid", { amount: formatMoney(booking.paidCents, locale) })
                : booking.status === "completed"
                  ? <span className="text-signal">{t("admin.bookings.notPaid")}</span>
                  : <span className="text-muted">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
