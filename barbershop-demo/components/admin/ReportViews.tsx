import { getTranslations } from "next-intl/server";
import { addClosure, saveSettings } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { presetRange, utilisation } from "@/lib/admin/analytics";
import type { BookingStatus } from "@/lib/admin/types";
import { addDays, businessDate, zonedInstant } from "@/lib/business-time";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";
import { Chip, Field, Figure, Table, TD, TH, type AdminContext } from "./parts";

const PRESETS = ["today", "7d", "30d"] as const;
const STATUS_ORDER: BookingStatus[] = ["confirmed", "completed", "no_show", "cancelled", "pending", "expired"];
const isDate = (value: string | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Figures for a range of dates, each with how it was counted. */
export async function AnalyticsView({ source, base, locale, query }: AdminContext) {
  const t = await getTranslations();
  const today = businessDate(new Date());

  const custom = query.range === "custom" && isDate(query.from) && isDate(query.to) && query.from <= query.to;
  const preset = PRESETS.find((candidate) => candidate === query.range) ?? "30d";
  // A custom range is capped at a year: nothing here needs more, and the query stays cheap.
  const range = custom ? { from: query.from!, to: query.to! > addDays(query.from!, 366) ? addDays(query.from!, 366) : query.to! } : presetRange(preset, today);
  const a = await source.analytics(range.from, range.to);
  const day = (date: string) => formatDateTime(zonedInstant(date, "12:00"), locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <h1 className="type-h1">{t("admin.analytics.title")}</h1>

      <nav aria-label={t("admin.analytics.title")} className="mt-8 flex flex-wrap gap-2">
        {PRESETS.map((value) => (
          <Chip key={value} href={{ pathname: `${base}/analytics`, query: { range: value } }} current={!custom && preset === value}>
            {t(`admin.analytics.presets.${value}`)}
          </Chip>
        ))}
      </nav>
      <form method="get" className="mt-6 flex flex-wrap items-end gap-4">
        <input type="hidden" name="range" value="custom" />
        <Field label={t("admin.analytics.from")} name="from" type="date" required defaultValue={range.from} max={today} />
        <Field label={t("admin.analytics.to")} name="to" type="date" required defaultValue={range.to} />
        <Button type="submit" variant="outline">
          {t("admin.analytics.apply")}
        </Button>
      </form>

      <p className="type-lead mt-10">{t("admin.analytics.range", { from: day(range.from), to: day(range.to) })}</p>
      {source.readOnly && <p className="type-body mt-4 max-w-2xl border border-signal p-4">{t("admin.analytics.demoNote")}</p>}

      <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        <Figure label={t("admin.analytics.bookings")} value={a.bookings} />
        <Figure label={t("admin.analytics.completed")} value={a.byStatus.completed ?? 0} />
        <Figure label={`${t("admin.analytics.cancelled")} + ${t("admin.analytics.noShows")}`} value={(a.byStatus.cancelled ?? 0) + (a.byStatus.no_show ?? 0)} note={`${t("booking.status.cancelled")}: ${a.byStatus.cancelled ?? 0} · ${t("booking.status.no_show")}: ${a.byStatus.no_show ?? 0}`} />
        <Figure label={t("admin.analytics.revenue")} value={formatMoney(a.paidCents, locale)} note={t("admin.analytics.revenueNote", { count: a.payments })} />
      </div>

      <div className="mt-16 grid gap-x-8 gap-y-14 lg:grid-cols-2">
        <section aria-labelledby="by-status" className="min-w-0">
          <h2 id="by-status" className="type-h2 mb-6">
            {t("admin.analytics.byStatus")}
          </h2>
          {a.bookings === 0 ? (
            <p className="type-body border-t border-line py-5 text-muted">{t("admin.analytics.none")}</p>
          ) : (
            <dl className="type-body border-t border-line">
              {STATUS_ORDER.filter((status) => a.byStatus[status]).map((status) => (
                <div key={status} className="flex justify-between gap-6 border-b border-line py-3">
                  <dt>{t(`booking.status.${status}`)}</dt>
                  <dd className="tabular-nums">{a.byStatus[status]}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section aria-labelledby="top-services" className="min-w-0">
          <h2 id="top-services" className="type-h2">
            {t("admin.analytics.topServices")}
          </h2>
          <p className="type-small mb-6 mt-2 text-muted">{t("admin.analytics.topServicesNote")}</p>
          {a.topServices.length === 0 ? (
            <p className="type-body border-t border-line py-5 text-muted">{t("admin.analytics.none")}</p>
          ) : (
            <Table caption={t("admin.analytics.topServices")}>
              <thead>
                <tr>
                  <th scope="col" className={TH}>{t("admin.analytics.service")}</th>
                  <th scope="col" className={`${TH} text-right`}>{t("admin.analytics.visits")}</th>
                  <th scope="col" className={`${TH} text-right`}>{t("admin.analytics.listed")}</th>
                </tr>
              </thead>
              <tbody>
                {a.topServices.map((service) => (
                  <tr key={service.name.en}>
                    <td className={TD}>{service.name[locale]}</td>
                    <td className={`${TD} text-right tabular-nums`}>{service.visits}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatMoney(service.listedCents, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>

      <section aria-labelledby="by-barber" className="mt-16">
        <h2 id="by-barber" className="type-h2 mb-6">
          {t("admin.analytics.barbersTitle")}
        </h2>
        <Table caption={t("admin.analytics.barbersTitle")}>
          <thead>
            <tr>
              <th scope="col" className={TH}>{t("admin.analytics.barber")}</th>
              {(["completed", "noShows", "cancelled", "booked", "available", "utilisation", "paid"] as const).map((column) => (
                <th key={column} scope="col" className={`${TH} text-right`}>
                  {t(`admin.analytics.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.barbers.map((barber) => {
              const share = utilisation(barber.bookedMinutes, barber.availableMinutes);
              return (
                <tr key={barber.id}>
                  <th scope="row" className={`${TD} text-left font-normal`}>{barber.name}</th>
                  <td className={`${TD} text-right tabular-nums`}>{barber.completed}</td>
                  <td className={`${TD} text-right tabular-nums`}>{barber.noShows}</td>
                  <td className={`${TD} text-right tabular-nums`}>{barber.cancelled}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatDuration(barber.bookedMinutes, locale)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatDuration(barber.availableMinutes, locale)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{share === null ? "—" : `${share}%`}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatMoney(barber.paidCents, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </section>

      {/* The definitions sit on the page with the numbers, not in a manual. */}
      <section aria-labelledby="method" className="mt-16 max-w-3xl border-t border-line pt-8">
        <h2 id="method" className="type-h3">
          {t("admin.analytics.methodTitle")}
        </h2>
        <ul className="type-body mt-4 space-y-3 text-muted">
          {(["method1", "method2", "method3", "method4", "method5"] as const).map((key) => (
            <li key={key}>{t(`admin.analytics.${key}`)}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Everyone who has a booking. */
export async function ClientsView({ source, locale }: AdminContext) {
  const t = await getTranslations("admin.clients");
  const clients = await source.clients();
  const date = (value: Date | null) => (value ? formatDateTime(value, locale, { day: "numeric", month: "short", year: "numeric" }) : t("never"));

  return (
    <>
      <h1 className="type-h1">{t("title")}</h1>
      <p className="type-lead mt-5 max-w-2xl text-muted">{t("lead")}</p>
      <div className="mt-10">
        {clients.length === 0 ? (
          <p className="type-body border-t border-line py-5 text-muted">{t("empty")}</p>
        ) : (
          <Table caption={t("title")}>
            <thead>
              <tr>
                <th scope="col" className={TH}>{t("name")}</th>
                <th scope="col" className={TH}>{t("email")}</th>
                <th scope="col" className={`${TH} text-right`}>{t("visits")}</th>
                <th scope="col" className={`${TH} text-right`}>{t("noShows")}</th>
                <th scope="col" className={TH}>{t("last")}</th>
                <th scope="col" className={TH}>{t("next")}</th>
                <th scope="col" className={TH}>{t("account")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.email}>
                  <td className={TD}>
                    {client.name}
                    <span className="block text-muted">{client.phone}</span>
                  </td>
                  <td className={`${TD} break-all`}>{client.email}</td>
                  <td className={`${TD} text-right tabular-nums`}>{client.visits}</td>
                  <td className={`${TD} text-right tabular-nums`}>{client.noShows}</td>
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>{date(client.lastVisit)}</td>
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>{date(client.nextVisit)}</td>
                  <td className={TD}>{t(client.hasAccount ? "yes" : "no")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}

/** The shop's details, the numbers of the booking policy, and the days it is closed. */
export async function SettingsView({ source, locale }: AdminContext) {
  const t = await getTranslations("admin");
  const [shop, timeOff] = await Promise.all([source.shop(), source.timeOff()]);
  const today = businessDate(new Date());
  const { policy } = shop;
  const planned = timeOff.filter((entry) => entry.status === "approved");
  const Shell = source.readOnly ? "div" : "form";

  return (
    <>
      <h1 className="type-h1">{t("settings.title")}</h1>

      <div className="mt-10 grid gap-x-8 gap-y-16 lg:grid-cols-12">
        {/* In the demo the same fields are shown switched off, inside no form: there is nothing to post. */}
        <Shell className="lg:col-span-7" {...(source.readOnly ? {} : { action: saveSettings })}>
          {!source.readOnly && <input type="hidden" name="locale" value={locale} />}
          <fieldset disabled={source.readOnly} className="space-y-12 disabled:opacity-70">
            <div>
              <h2 className="type-h3 mb-6">{t("settings.shopTitle")}</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label={t("settings.name")} name="name" required maxLength={80} defaultValue={shop.name} className="sm:col-span-2" />
                <Field label={t("settings.address")} name="address" required maxLength={120} defaultValue={shop.addressLine1} className="sm:col-span-2" />
                <Field label={t("settings.city")} name="city" required maxLength={80} defaultValue={shop.city} />
                <Field label={t("settings.postcode")} name="postcode" required maxLength={20} defaultValue={shop.postcode} />
                <Field label={t("settings.phone")} name="phone" required maxLength={40} defaultValue={shop.phone} />
                <Field label={t("settings.email")} name="email" type="email" required maxLength={254} defaultValue={shop.email} />
              </div>
            </div>

            <div>
              <h2 className="type-h3">{t("settings.policyTitle")}</h2>
              <p className="type-small mb-6 mt-3 max-w-xl text-muted">{t("settings.policyNote")}</p>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label={t("settings.hold")} name="hold" type="number" required min={1} max={120} defaultValue={policy.holdMinutes} />
                <Field label={t("settings.lead")} name="lead" type="number" required min={0} max={1440} defaultValue={policy.minLeadMinutes} />
                <Field label={t("settings.horizon")} name="horizon" type="number" required min={1} max={365} defaultValue={policy.horizonDays} />
                <Field label={t("settings.cutoff")} name="cutoff" type="number" required min={0} max={168} defaultValue={policy.changeCutoffHours} />
                <Field label={t("settings.maxBreak")} name="maxBreak" type="number" required min={5} max={480} defaultValue={policy.maxBreakMinutes} />
              </div>
              <p className="type-small mt-6 text-muted">{t("settings.fixed")}</p>
            </div>

            {source.readOnly ? (
              <p className="type-body text-muted">{t("demoReadOnly")}</p>
            ) : (
              <Button type="submit" variant="signal">
                {t("settings.save")}
              </Button>
            )}
          </fieldset>
        </Shell>

        <aside className="lg:col-span-4 lg:col-start-9">
          <h2 className="type-h3 mb-6">{t("settings.closuresTitle")}</h2>
          {planned.length === 0 ? (
            <p className="type-body border-t border-line py-5 text-muted">{t("settings.closuresEmpty")}</p>
          ) : (
            <ul className="type-body border-t border-line">
              {planned.map((entry) => (
                <li key={entry.id} className="border-b border-line py-3">
                  {entry.barberName ?? t("overview.wholeShop")}
                  <span className="block tabular-nums text-muted">
                    {formatDateTime(entry.startsAt, locale, { day: "numeric", month: "long" })} –{" "}
                    {formatDateTime(new Date(entry.endsAt.getTime() - 60_000), locale, { day: "numeric", month: "long" })}
                    {entry.reason && ` · ${entry.reason}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!source.readOnly && (
            <form action={addClosure} className="mt-12 space-y-6">
              <input type="hidden" name="locale" value={locale} />
              <h2 className="type-h3">{t("settings.addClosureTitle")}</h2>
              <Field label={t("settings.firstDay")} name="first" type="date" required min={today} />
              <Field label={t("settings.lastDay")} name="last" type="date" required min={today} />
              <Field label={t("settings.reason")} name="reason" maxLength={200} />
              <Button type="submit" variant="outline">
                {t("settings.addClosure")}
              </Button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
