import { getTranslations } from "next-intl/server";
import { createBooking } from "@/app/actions/admin";
import { FIELD } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/Button";
import { routing } from "@/i18n/routing";
import { staffAvailability } from "@/lib/admin/slots";
import { addDays, businessDate } from "@/lib/business-time";
import { eligibleBarbers, totals } from "@/lib/catalog";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";
import { Field, type AdminContext } from "./parts";

/**
 * A booking taken over the phone or at the counter, in two steps that both
 * work without JavaScript: a GET that settles services, barber and date and
 * shows the free times, then a POST with the time and the client's details.
 */
export async function NewBookingView({ source, locale, query, queryAll }: AdminContext & { queryAll: Record<string, string[]> }) {
  const t = await getTranslations();
  const [services, barbers, shop] = await Promise.all([source.services(), source.barbers(), source.shop()]);
  const offered = services.filter((service) => service.isActive);
  const today = businessDate(new Date());

  const chosenIds = (queryAll.services ?? []).filter((id) => offered.some((service) => service.id === id));
  const chosen = offered.filter((service) => chosenIds.includes(service.id));
  const able = eligibleBarbers(barbers.filter((barber) => barber.isActive), chosenIds);
  const barber = able.find((candidate) => candidate.id === query.barber);
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : today;
  const ready = chosen.length > 0 && barber !== undefined;
  const slots = ready ? await staffAvailability(chosenIds, barber.id, date) : null;
  const sum = totals(chosen);

  // Where an error sends the admin back to: this page, with the first step as it was.
  const returnTo = `/bookings/new?${new URLSearchParams([...chosenIds.map((id) => ["services", id]), ["barber", query.barber ?? ""], ["date", date]]).toString()}`;

  return (
    <>
      <h1 className="type-h1">{t("admin.newBooking.title")}</h1>
      <p className="type-lead mt-5 max-w-2xl text-muted">{t("admin.newBooking.lead")}</p>

      <div className="mt-12 grid gap-x-8 gap-y-14 lg:grid-cols-12">
        <form method="get" className="lg:col-span-6">
          <h2 className="type-h3">{t("admin.newBooking.step1")}</h2>
          <fieldset className="mt-6">
            <legend className="type-eyebrow text-muted">{t("admin.bookings.services")}</legend>
            <ul className="mt-3 border-t border-line">
              {offered.map((service) => (
                <li key={service.id} className="border-b border-line">
                  <label className="type-body flex min-h-12 cursor-pointer items-center gap-4 py-2">
                    <input type="checkbox" name="services" value={service.id} defaultChecked={chosenIds.includes(service.id)} className="size-5 accent-(--color-signal)" />
                    <span className="flex-1">{service.name[locale]}</span>
                    <span className="tabular-nums text-muted">
                      {formatDuration(service.durationMinutes, locale)} · {formatMoney(service.priceCents, locale)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="f-barber" className="type-eyebrow block text-muted">
                {t("admin.newBooking.chooseBarber")}
              </label>
              <select id="f-barber" name="barber" defaultValue={barber?.id ?? ""} required className={`${FIELD} [&>option]:text-ink`}>
                <option value="" disabled>
                  —
                </option>
                {/* Before any service is chosen every barber is listed; afterwards only those who deliver all of them. */}
                {(chosen.length ? able : barbers.filter((candidate) => candidate.isActive)).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label={t("admin.booking.pickDate")} name="date" type="date" required min={today} max={addDays(today, shop.policy.horizonDays)} defaultValue={date} />
          </div>

          {chosen.length > 0 && able.length === 0 && <p className="type-body mt-6 font-medium">{t("admin.newBooking.noBarber")}</p>}
          <Button type="submit" variant="outline" className="mt-8">
            {t("admin.booking.showTimes")}
          </Button>
        </form>

        <div className="lg:col-span-5 lg:col-start-8">
          <h2 className="type-h3">{t("admin.newBooking.step2")}</h2>
          {!slots && <p className="type-body mt-6 text-muted">{t("admin.newBooking.pickFirst")}</p>}
          {slots && slots.length === 0 && <p className="type-body mt-6 text-muted">{t("admin.booking.noTimes")}</p>}
          {slots && slots.length > 0 && barber && (
            <form action={createBooking} className="mt-6 space-y-6">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="barberId" value={barber.id} />
              {chosenIds.map((id) => (
                <input key={id} type="hidden" name="services" value={id} />
              ))}
              <p className="type-body">
                {barber.name} · {formatDateTime(slots[0], locale, { weekday: "long", day: "numeric", month: "long" })}
                <span className="block tabular-nums text-muted">
                  {formatDuration(sum.durationMinutes, locale)} · {formatMoney(sum.priceCents, locale)}
                </span>
              </p>
              <div>
                <label htmlFor="f-startsAt" className="type-eyebrow block text-muted">
                  {t("admin.newBooking.time")}
                </label>
                <select id="f-startsAt" name="startsAt" required className={`${FIELD} [&>option]:text-ink`}>
                  {slots.map((slot) => (
                    <option key={slot.toISOString()} value={slot.toISOString()}>
                      {formatDateTime(slot, locale, { hour: "2-digit", minute: "2-digit" })}
                    </option>
                  ))}
                </select>
              </div>
              <Field label={t("admin.newBooking.clientName")} name="name" required maxLength={80} autoComplete="off" />
              <Field label={t("admin.newBooking.clientEmail")} name="email" type="email" required maxLength={254} autoComplete="off" />
              <Field label={t("admin.newBooking.clientPhone")} name="phone" type="tel" required maxLength={40} autoComplete="off" />
              <div>
                <label htmlFor="f-language" className="type-eyebrow block text-muted">
                  {t("admin.newBooking.emailLanguage")}
                </label>
                <select id="f-language" name="language" defaultValue={locale} className={`${FIELD} [&>option]:text-ink`}>
                  {routing.locales.map((language) => (
                    <option key={language} value={language}>
                      {t(`locale.${language}`)}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="signal" size="lg">
                {t("admin.newBooking.create")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
