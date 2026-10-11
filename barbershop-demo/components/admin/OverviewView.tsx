import { getTranslations } from "next-intl/server";
import { decideTimeOff, recordOutcome } from "@/app/actions/admin";
import { ArrowLink, Button } from "@/components/ui/Button";
import { addDays, businessDate, zonedInstant } from "@/lib/business-time";
import { formatDateTime } from "@/lib/format";
import { BookingRows } from "./BookingRows";
import { Figure, type AdminContext } from "./parts";

/** What needs attention today: appointments without an outcome, requests without a decision, and who is in. */
export async function OverviewView({ source, base, locale }: AdminContext) {
  const t = await getTranslations("admin");
  const today = businessDate(new Date());
  const start = zonedInstant(today, "00:00");
  const end = zonedInstant(addDays(today, 1), "00:00");

  const [todays, awaiting, timeOff, recent] = await Promise.all([
    source.bookingsBetween(start, end),
    source.awaitingOutcome(),
    source.timeOff(),
    source.bookingsBetween(zonedInstant(addDays(today, -30), "00:00"), end),
  ]);
  const requests = timeOff.filter((entry) => entry.status === "requested");
  const unpaid = recent.filter((booking) => booking.status === "completed" && booking.paidCents === null);
  const active = todays.filter((booking) => booking.status !== "cancelled");

  return (
    <>
      <h1 className="type-h1">{t("overview.title")}</h1>
      <p className="type-body mt-4 text-muted">{formatDateTime(start, locale, { weekday: "long", day: "numeric", month: "long" })}</p>

      <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        <Figure label={t("overview.todayBookings")} value={active.length} />
        <Figure label={t("overview.awaiting")} value={awaiting.length} />
        <Figure label={t("overview.requests")} value={requests.length} />
        <Figure label={t("overview.unpaid")} value={unpaid.length} />
      </div>

      {!source.readOnly && (
        <section aria-labelledby="awaiting-title" className="mt-16">
          <h2 id="awaiting-title" className="type-h2 mb-6">
            {t("overview.awaitingTitle")}
          </h2>
          {awaiting.length === 0 ? (
            <p className="type-body border-t border-line py-5 text-muted">{t("overview.awaitingEmpty")}</p>
          ) : (
            <ul className="border-t border-line">
              {awaiting.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b border-line py-4">
                  <p className="type-body">
                    <span className="tabular-nums">
                      {formatDateTime(booking.startsAt, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>{" "}
                    · {booking.customerName} · <span className="text-muted">{booking.barberName}</span>
                  </p>
                  <form action={recordOutcome} className="flex flex-wrap gap-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="returnTo" value="" />
                    <Button type="submit" name="outcome" value="completed" variant="solid">
                      {t("booking.completed")}
                    </Button>
                    <Button type="submit" name="outcome" value="no_show" variant="outline">
                      {t("booking.noShow")}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="requests-title" className="mt-16">
        <h2 id="requests-title" className="type-h2 mb-6">
          {t("overview.requestsTitle")}
        </h2>
        {requests.length === 0 ? (
          <p className="type-body border-t border-line py-5 text-muted">{t("overview.requestsEmpty")}</p>
        ) : (
          <ul className="border-t border-line">
            {requests.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b border-line py-4">
                <p className="type-body">
                  {entry.barberName ?? t("overview.wholeShop")} ·{" "}
                  <span className="tabular-nums">
                    {formatDateTime(entry.startsAt, locale, { day: "numeric", month: "long" })} –{" "}
                    {formatDateTime(new Date(entry.endsAt.getTime() - 60_000), locale, { day: "numeric", month: "long" })}
                  </span>
                  {entry.reason && <span className="text-muted"> · {entry.reason}</span>}
                </p>
                {source.readOnly ? (
                  <p className="type-small text-muted">{t("demoReadOnly")}</p>
                ) : (
                  <form action={decideTimeOff} className="flex flex-wrap gap-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="returnTo" value="" />
                    <Button type="submit" name="decision" value="approve" variant="solid">
                      {t("overview.approve")}
                    </Button>
                    <Button type="submit" name="decision" value="decline" variant="outline">
                      {t("overview.decline")}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="schedule-title" className="mt-16">
        <h2 id="schedule-title" className="type-h2 mb-6">
          {t("overview.scheduleTitle")}
        </h2>
        <BookingRows bookings={todays} base={base} locale={locale} empty={t("calendar.empty")} showDate={false} />
        <ArrowLink href={`${base}/calendar`} className="mt-8">
          {t("overview.openCalendar")}
        </ArrowLink>
      </section>
    </>
  );
}
