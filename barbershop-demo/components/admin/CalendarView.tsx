import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { addDays, businessDate, isoWeekday, zonedInstant } from "@/lib/business-time";
import { formatDateTime } from "@/lib/format";
import { Chip, type AdminContext } from "./parts";

/** Days shown before today and after it. */
const BACK = 3;
const AHEAD = 14;

/** One day, every chair side by side: who works, who is booked, when. */
export async function CalendarView({ source, base, locale, query }: AdminContext) {
  const t = await getTranslations();
  const today = businessDate(new Date());
  const days = Array.from({ length: BACK + AHEAD + 1 }, (_, index) => addDays(today, index - BACK));
  const date = query.date && days.includes(query.date) ? query.date : today;

  const [barbers, bookings] = await Promise.all([
    source.barbers(),
    source.bookingsBetween(zonedInstant(date, "00:00"), zonedInstant(addDays(date, 1), "00:00")),
  ]);
  const clock = { hour: "2-digit", minute: "2-digit" } as const;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="type-h1">{t("admin.calendar.title")}</h1>
        {!source.readOnly && (
          <ButtonLink href={{ pathname: `${base}/bookings/new`, query: { date } }} variant="signal">
            {t("admin.calendar.newBooking")}
          </ButtonLink>
        )}
      </div>

      <nav aria-label={t("admin.calendar.title")} className="-mx-gutter mt-8 overflow-x-auto px-gutter pb-3">
        <ul className="flex gap-2">
          {days.map((day) => (
            <li key={day}>
              <Chip href={{ pathname: `${base}/calendar`, query: { date: day } }} current={day === date}>
                {day === today ? t("booking.time.today") : formatDateTime(zonedInstant(day, "12:00"), locale, { weekday: "short", day: "numeric", month: "short" })}
              </Chip>
            </li>
          ))}
        </ul>
      </nav>

      <h2 className="type-h2 mt-10">{formatDateTime(zonedInstant(date, "12:00"), locale, { weekday: "long", day: "numeric", month: "long" })}</h2>

      {/* A column per chair on wide screens; the chairs follow one another on a phone. */}
      <div className="mt-8 grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-4">
        {barbers
          .filter((barber) => barber.isActive)
          .map((barber) => {
            const ranges = barber.hours.filter((range) => range.weekday === isoWeekday(date));
            const own = bookings.filter((booking) => booking.barberId === barber.id);
            return (
              <section key={barber.id} aria-labelledby={`chair-${barber.id}`} className="border-t border-line pt-4">
                <h3 id={`chair-${barber.id}`} className="type-h3">
                  {barber.name}
                </h3>
                <p className="type-small mt-1 tabular-nums text-muted">
                  {ranges.length === 0 ? t("admin.calendar.dayOff") : ranges.map((range) => `${range.start} – ${range.end}`).join(", ")}
                </p>
                {own.length === 0 ? (
                  <p className="type-body mt-5 text-muted">{t("admin.calendar.empty")}</p>
                ) : (
                  <ul className="mt-5 space-y-2">
                    {own.map((booking) => (
                      <li key={booking.id}>
                        <Link
                          href={`${base}/bookings/${booking.id}`}
                          className={`block border border-line p-3 transition-colors duration-(--duration-fast) hover:border-fg ${
                            booking.status === "cancelled" ? "text-muted line-through" : ""
                          }`}
                        >
                          <span className="type-label block tabular-nums">
                            {formatDateTime(booking.startsAt, locale, clock)} – {formatDateTime(booking.endsAt, locale, clock)}
                          </span>
                          <span className="type-body mt-2 block">{booking.customerName}</span>
                          <span className="type-small block text-muted">
                            {booking.services.map((service) => service.name[locale]).join(", ")}
                          </span>
                          {booking.status !== "confirmed" && (
                            <span className="type-eyebrow mt-2 block text-muted no-underline">{t(`booking.status.${booking.status}`)}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
      </div>
    </>
  );
}
