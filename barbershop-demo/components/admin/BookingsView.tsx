import { getTranslations } from "next-intl/server";
import { FIELD } from "@/components/auth/AuthForm";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { BookingStatus } from "@/lib/admin/types";
import { BookingRows } from "./BookingRows";
import { Field, type AdminContext } from "./parts";

const STATUSES: BookingStatus[] = ["confirmed", "completed", "no_show", "cancelled", "pending", "expired"];

/** Every booking, newest first, with a search and a status filter. */
export async function BookingsView({ source, base, locale, query }: AdminContext) {
  const t = await getTranslations();
  const status = STATUSES.find((candidate) => candidate === query.status);
  const bookings = await source.findBookings({ status, search: query.q });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="type-h1">{t("admin.bookings.title")}</h1>
        {!source.readOnly && (
          <ButtonLink href={`${base}/bookings/new`} variant="signal">
            {t("admin.calendar.newBooking")}
          </ButtonLink>
        )}
      </div>

      {/* A plain GET form: the filter lives in the address and can be bookmarked. */}
      <form method="get" className="mt-10 grid gap-6 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <Field label={t("admin.bookings.search")} name="q" type="search" defaultValue={query.q ?? ""} />
        <div>
          <label htmlFor="f-status" className="type-eyebrow block text-muted">
            {t("admin.bookings.status")}
          </label>
          <select id="f-status" name="status" defaultValue={status ?? ""} className={`${FIELD} [&>option]:text-ink`}>
            <option value="">{t("admin.bookings.anyStatus")}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`booking.status.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          {t("admin.bookings.filter")}
        </Button>
      </form>

      <div className="mt-10">
        <BookingRows bookings={bookings} base={base} locale={locale} empty={t("admin.bookings.empty")} />
        {bookings.length === 200 && <p className="type-small mt-4 text-muted">{t("admin.bookings.limit")}</p>}
      </div>
    </>
  );
}
