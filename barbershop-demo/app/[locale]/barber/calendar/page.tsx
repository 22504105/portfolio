import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { addBreak, removeTimeOff, requestTimeOff } from "@/app/actions/account";
import { BookingList } from "@/components/account/BookingList";
import { StaffForm } from "@/components/barber/StaffForm";
import { Container } from "@/components/layout/Container";
import { ArrowLink, Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { listBarberBookings, listBarberTimeOff } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { addDays, businessDate, isoWeekday, zonedInstant } from "@/lib/business-time";
import { getCatalog } from "@/lib/catalog/server";
import { formatDateTime } from "@/lib/format";
import { pageLocale } from "@/lib/page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** How many days ahead the strip of days reaches. */
const DAYS = 21;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function BarberCalendarPage({ params, searchParams }: PageProps<"/[locale]/barber/calendar">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("barber");
  const user = await requireUser(locale, "/barber/calendar", ["barber"]);

  if (!user.barberId) {
    return (
      <Container className="py-section">
        <p className="type-eyebrow text-muted">{t("eyebrow")}</p>
        <p className="type-lead mt-6 max-w-xl">{t("noProfile")}</p>
      </Container>
    );
  }

  const today = businessDate(new Date());
  const days = Array.from({ length: DAYS }, (_, index) => addDays(today, index));
  const asked = first((await searchParams).date);
  const date = asked && days.includes(asked) ? asked : today;

  const [{ shop, barbers }, bookings, timeOff] = await Promise.all([
    getCatalog(),
    listBarberBookings(user.id, user.barberId, zonedInstant(date, "00:00"), zonedInstant(addDays(date, 1), "00:00")),
    listBarberTimeOff(user.id, user.barberId),
  ]);
  const ranges = barbers.find((barber) => barber.id === user.barberId)?.hours.filter((range) => range.weekday === isoWeekday(date)) ?? [];
  const errors = Object.fromEntries(
    (["invalid", "break_too_long", "has_bookings", "in_the_past", "forbidden", "failed"] as const).map((code) => [
      code,
      t(`errors.${code}`, { minutes: shop.policy.maxBreakMinutes }),
    ]),
  );
  const clock = { hour: "2-digit", minute: "2-digit" } as const;

  return (
    <Container className="py-section">
      <p className="type-eyebrow text-muted">{t("eyebrow")}</p>
      <h1 className="type-h1 mt-5">{t("calendarTitle")}</h1>

      {/* The same strip of days as the booking page, as links: each day is its own address. */}
      <nav aria-label={t("calendarTitle")} className="-mx-gutter mt-10 overflow-x-auto px-gutter pb-3 pt-1">
        <ul className="flex gap-2">
          {days.map((day, index) => {
            const noon = zonedInstant(day, "12:00");
            const current = day === date;
            return (
              <li key={day} className="shrink-0">
                <Link
                  href={{ pathname: "/barber/calendar", query: { date: day } }}
                  aria-current={current ? "date" : undefined}
                  aria-label={formatDateTime(noon, locale, { weekday: "long", day: "numeric", month: "long" })}
                  className="flex h-20 min-w-16 flex-col items-center justify-center gap-1 border border-line px-2 transition-colors duration-(--duration-fast) hover:border-fg aria-[current]:border-signal aria-[current]:bg-signal aria-[current]:text-ink"
                >
                  <span className="type-eyebrow">{index === 0 ? t("today") : formatDateTime(noon, locale, { weekday: "short" })}</span>
                  <span className="type-h3 tabular-nums">{formatDateTime(noon, locale, { day: "numeric" })}</span>
                  <span className="type-eyebrow opacity-70">{formatDateTime(noon, locale, { month: "short" })}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-10 grid gap-x-8 gap-y-14 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <h2 className="type-h2">{formatDateTime(zonedInstant(date, "12:00"), locale, { weekday: "long", day: "numeric", month: "long" })}</h2>
          <p className="type-body mt-3 text-muted">
            {ranges.length === 0
              ? t("dayOff")
              : `${t("workingHours")}: ${ranges.map((range) => `${range.start} – ${range.end}`).join(", ")}`}
          </p>

          <h3 className="type-eyebrow mb-4 mt-10 text-muted">{t("appointments")}</h3>
          <BookingList bookings={bookings} empty={t("nothingThatDay")} view="barber" />

          <h3 className="type-eyebrow mb-4 mt-12 text-muted">{t("myTimeOff")}</h3>
          {timeOff.length === 0 ? (
            <p className="type-body border-t border-line py-5 text-muted">{t("noTimeOff")}</p>
          ) : (
            <ul className="border-t border-line">
              {timeOff.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line py-4">
                  <div className="type-body">
                    <p>
                      {t(`kinds.${entry.kind}`)} · <span className="text-muted">{t(`statuses.${entry.status}`)}</span>
                    </p>
                    <p className="tabular-nums text-muted">
                      {formatDateTime(entry.startsAt, locale, { day: "numeric", month: "long", ...clock })} –{" "}
                      {/* A break shows its end time; whole days show the last day, not the midnight after it. */}
                      {entry.kind === "break"
                        ? formatDateTime(entry.endsAt, locale, clock)
                        : formatDateTime(new Date(entry.endsAt.getTime() - 60_000), locale, { day: "numeric", month: "long" })}
                    </p>
                  </div>
                  {entry.removable && (
                    <form action={removeTimeOff}>
                      <input type="hidden" name="id" value={entry.id} />
                      <Button type="submit" variant="outline">
                        {t("remove")}
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-14 lg:col-span-4 lg:col-start-9">
          <section aria-labelledby="break-title">
            <h2 id="break-title" className="type-h3">
              {t("breakTitle")}
            </h2>
            <p className="type-small mb-6 mt-3 text-muted">{t("breakLead", { minutes: shop.policy.maxBreakMinutes })}</p>
            <StaffForm
              action={addBreak}
              hidden={{ date }}
              fields={[
                { name: "from", label: t("from"), type: "time", defaultValue: "13:00" },
                { name: "to", label: t("to"), type: "time", defaultValue: "13:30" },
              ]}
              submit={t("addBreak")}
              errors={errors}
              done={{ added: t("added") }}
            />
          </section>

          <section aria-labelledby="time-off-title">
            <h2 id="time-off-title" className="type-h3">
              {t("timeOffTitle")}
            </h2>
            <p className="type-small mb-6 mt-3 text-muted">{t("timeOffLead")}</p>
            <StaffForm
              action={requestTimeOff}
              fields={[
                { name: "first", label: t("firstDay"), type: "date", min: addDays(today, 1) },
                { name: "last", label: t("lastDay"), type: "date", min: addDays(today, 1) },
                { name: "reason", label: t("reason"), type: "text", required: false },
              ]}
              submit={t("requestTimeOff")}
              errors={errors}
              done={{ requested: t("requested") }}
            />
          </section>
        </aside>
      </div>

      <ArrowLink href="/barber" className="mt-14">
        {t("toToday")}
      </ArrowLink>
    </Container>
  );
}
