import { getTranslations } from "next-intl/server";
import { cancelBooking, moveBooking, recordOutcome, recordPayment, removePayment } from "@/app/actions/admin";
import { FIELD } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { staffRescheduleAvailability } from "@/lib/admin/slots";
import { addDays, businessDate } from "@/lib/business-time";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";
import { centsToInput } from "@/lib/money";
import { Field, type AdminContext } from "./parts";

/** One booking: what it is, what happened to it, and what an admin can do next. */
export async function BookingDetailView({ source, base, locale, query, id }: AdminContext & { id: string }) {
  const t = await getTranslations();
  const found = await source.booking(id);

  if (!found) {
    return (
      <>
        <p className="type-lead">{t("admin.booking.notFound")}</p>
        <Link href={`${base}/bookings`} className="type-label mt-6 inline-flex min-h-11 items-center underline underline-offset-4">
          {t("admin.booking.back")}
        </Link>
      </>
    );
  }

  const { booking, events } = found;
  const here = `/bookings/${booking.id}`;
  const clock = { hour: "2-digit", minute: "2-digit" } as const;
  const started = booking.startsAt <= new Date();
  const today = businessDate(new Date());
  // The free times for a move are asked for only once a date has been chosen.
  const moveDate = query.move && /^\d{4}-\d{2}-\d{2}$/.test(query.move) ? query.move : null;
  const moveSlots = !source.readOnly && moveDate && booking.status === "confirmed" ? await staffRescheduleAvailability(booking.id, moveDate) : null;

  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="bookingId" value={booking.id} />
      <input type="hidden" name="returnTo" value={here} />
    </>
  );
  const row = "grid gap-1 border-b border-line py-4 sm:grid-cols-[10rem_1fr]";
  const label = "type-eyebrow pt-1 text-muted";

  return (
    <>
      <Link href={`${base}/bookings`} className="type-label inline-flex min-h-11 items-center text-muted transition-colors duration-(--duration-fast) hover:text-fg">
        <span aria-hidden="true">← </span>
        {t("admin.booking.back")}
      </Link>
      <h1 className="type-h1 mt-4 tabular-nums">{booking.reference}</h1>
      <p className="type-lead mt-4">
        {t(`booking.status.${booking.status}`)} <span className="text-muted">· {t(`admin.bookings.source.${booking.source}`)}</span>
      </p>

      <div className="mt-10 grid gap-x-8 gap-y-14 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <dl className="type-body border-t border-line">
            <div className={row}>
              <dt className={label}>{t("admin.bookings.when")}</dt>
              <dd className="tabular-nums">
                {formatDateTime(booking.startsAt, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })},{" "}
                {formatDateTime(booking.startsAt, locale, clock)} – {formatDateTime(booking.endsAt, locale, clock)}
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("admin.bookings.barber")}</dt>
              <dd>{booking.barberName}</dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("admin.bookings.client")}</dt>
              <dd>
                {booking.customerName}
                <span className="block break-words text-muted">
                  {booking.customerPhone} · {booking.customerEmail}
                </span>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("admin.bookings.services")}</dt>
              <dd>
                {booking.services.map((service) => (
                  <span key={service.name.en} className="flex justify-between gap-4">
                    <span>{service.name[locale]}</span>
                    <span className="tabular-nums">{formatMoney(service.priceCents, locale)}</span>
                  </span>
                ))}
                <span className="mt-1 block text-muted">{formatDuration(booking.totalDurationMinutes, locale)}</span>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("admin.booking.total")}</dt>
              <dd className="type-h3 tabular-nums">{formatMoney(booking.totalPriceCents, locale)}</dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("admin.bookings.payment")}</dt>
              <dd className="tabular-nums">
                {booking.paidCents !== null
                  ? `${t("admin.bookings.paid", { amount: formatMoney(booking.paidCents, locale) })} · ${t(`admin.booking.methods.${booking.paidMethod!}`)}`
                  : t("admin.bookings.notPaid")}
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("admin.booking.language")}</dt>
              <dd>{t(`locale.${booking.locale}`)}</dd>
            </div>
          </dl>

          <h2 className="type-h3 mt-12">{t("admin.booking.historyTitle")}</h2>
          <ol className="type-body mt-4 border-t border-line">
            {events.map((event, index) => (
              <li key={index} className="flex flex-wrap justify-between gap-x-6 border-b border-line py-3">
                <span>
                  {t(`admin.booking.events.${event.type as "created"}`)} <span className="text-muted">· {t(`admin.booking.actors.${event.actor as "admin"}`)}</span>
                </span>
                <span className="tabular-nums text-muted">
                  {formatDateTime(event.at, locale, { day: "numeric", month: "short", ...clock })}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="space-y-12 lg:col-span-4 lg:col-start-9">
          {source.readOnly ? (
            <p className="type-body border border-line p-4 text-muted">{t("admin.demoReadOnly")}</p>
          ) : (
            <>
              {/* An outcome can be recorded once the appointment has started, and corrected afterwards. */}
              {started && (booking.status === "confirmed" || booking.status === "completed" || booking.status === "no_show") && (
                <section aria-labelledby="outcome-title">
                  <h2 id="outcome-title" className="type-h3 mb-4">
                    {t("admin.booking.outcomeTitle")}
                  </h2>
                  <form action={recordOutcome} className="flex flex-wrap gap-2">
                    {hidden}
                    <Button type="submit" name="outcome" value="completed" variant={booking.status === "completed" ? "solid" : "outline"}>
                      {t("admin.booking.completed")}
                    </Button>
                    <Button type="submit" name="outcome" value="no_show" variant={booking.status === "no_show" ? "solid" : "outline"}>
                      {t("admin.booking.noShow")}
                    </Button>
                  </form>
                </section>
              )}

              {booking.status === "completed" && (
                <section aria-labelledby="payment-title">
                  <h2 id="payment-title" className="type-h3">
                    {t("admin.booking.paymentTitle")}
                  </h2>
                  <p className="type-small mb-6 mt-3 text-muted">{t("admin.booking.paymentNote")}</p>
                  <form action={recordPayment} className="space-y-6">
                    {hidden}
                    <Field
                      label={t("admin.booking.amount")}
                      name="amount"
                      inputMode="decimal"
                      required
                      defaultValue={centsToInput(booking.paidCents ?? booking.totalPriceCents)}
                    />
                    <div>
                      <label htmlFor="f-method" className="type-eyebrow block text-muted">
                        {t("admin.booking.method")}
                      </label>
                      <select id="f-method" name="method" defaultValue={booking.paidMethod ?? "card_terminal"} className={`${FIELD} [&>option]:text-ink`}>
                        <option value="card_terminal">{t("admin.booking.methods.card_terminal")}</option>
                        <option value="cash">{t("admin.booking.methods.cash")}</option>
                      </select>
                    </div>
                    <Field label={t("admin.booking.note")} name="note" maxLength={200} />
                    <Button type="submit" variant="signal">
                      {t("admin.booking.record")}
                    </Button>
                  </form>
                  {booking.paidCents !== null && (
                    <form action={removePayment} className="mt-4">
                      {hidden}
                      <Button type="submit" variant="outline">
                        {t("admin.booking.removePayment")}
                      </Button>
                    </form>
                  )}
                </section>
              )}

              {booking.status === "confirmed" && (
                <>
                  <section aria-labelledby="move-title">
                    <h2 id="move-title" className="type-h3">
                      {t("admin.booking.moveTitle")}
                    </h2>
                    <p className="type-small mb-6 mt-3 text-muted">{t("admin.booking.moveNote")}</p>
                    {/* Step one, a GET: choose the date. Step two, a POST: choose among its free times. */}
                    <form method="get" className="flex flex-wrap items-end gap-4">
                      <Field label={t("admin.booking.pickDate")} name="move" type="date" required min={today} max={addDays(today, 60)} defaultValue={moveDate ?? ""} className="flex-1" />
                      <Button type="submit" variant="outline">
                        {t("admin.booking.showTimes")}
                      </Button>
                    </form>
                    {moveSlots && moveSlots.length === 0 && <p className="type-body mt-6 text-muted">{t("admin.booking.noTimes")}</p>}
                    {moveSlots && moveSlots.length > 0 && (
                      <form action={moveBooking} className="mt-6">
                        {hidden}
                        <label htmlFor="f-startsAt" className="type-eyebrow block text-muted">
                          {t("admin.newBooking.time")}
                        </label>
                        <select id="f-startsAt" name="startsAt" required className={`${FIELD} [&>option]:text-ink`}>
                          {moveSlots
                            .filter((slot) => slot.getTime() !== booking.startsAt.getTime())
                            .map((slot) => (
                              <option key={slot.toISOString()} value={slot.toISOString()}>
                                {formatDateTime(slot, locale, clock)}
                              </option>
                            ))}
                        </select>
                        <Button type="submit" variant="solid" className="mt-6">
                          {t("admin.booking.moveButton")}
                        </Button>
                      </form>
                    )}
                  </section>

                  <section aria-labelledby="cancel-title">
                    <h2 id="cancel-title" className="type-h3">
                      {t("admin.booking.cancelTitle")}
                    </h2>
                    <p className="type-small mb-6 mt-3 text-muted">{t("admin.booking.cancelNote")}</p>
                    <form action={cancelBooking}>
                      {hidden}
                      <Button type="submit" variant="outline">
                        {t("admin.booking.cancelButton")}
                      </Button>
                    </form>
                  </section>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
