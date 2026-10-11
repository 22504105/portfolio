import { getTranslations } from "next-intl/server";
import { saveBarber, saveService } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import type { AdminBarber, AdminService } from "@/lib/admin/types";
import { formatDuration, formatMoney, formatWeekday } from "@/lib/format";
import { centsToInput } from "@/lib/money";
import { Field, type AdminContext } from "./parts";

const SUMMARY =
  "flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5 transition-colors duration-(--duration-fast) hover:text-signal [&::-webkit-details-marker]:hidden";
const CHECK = "type-body flex min-h-11 cursor-pointer items-center gap-3";

/** The service list. Each row opens into its form; in the demo it opens into its details only. */
export async function ServicesView({ source, locale }: AdminContext) {
  const t = await getTranslations("admin");
  const [services, barbers] = await Promise.all([source.services(), source.barbers()]);

  const form = (service?: AdminService) => (
    <form action={saveService} className="grid gap-6 pb-8 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      {service && <input type="hidden" name="id" value={service.id} />}
      <Field label={t("services.nameEn")} name="nameEn" id={`nameEn-${service?.id ?? "new"}`} required maxLength={80} defaultValue={service?.name.en} />
      <Field label={t("services.nameRu")} name="nameRu" id={`nameRu-${service?.id ?? "new"}`} required maxLength={80} defaultValue={service?.name.ru} lang="ru" />
      <Field label={t("services.descEn")} name="descEn" id={`descEn-${service?.id ?? "new"}`} required maxLength={300} defaultValue={service?.description.en} />
      <Field label={t("services.descRu")} name="descRu" id={`descRu-${service?.id ?? "new"}`} required maxLength={300} defaultValue={service?.description.ru} lang="ru" />
      <Field
        label={t("services.price")}
        name="price"
        id={`price-${service?.id ?? "new"}`}
        required
        inputMode="decimal"
        defaultValue={service ? centsToInput(service.priceCents) : undefined}
      />
      <Field
        label={t("services.duration")}
        name="duration"
        id={`duration-${service?.id ?? "new"}`}
        type="number"
        required
        min={5}
        max={480}
        step={5}
        defaultValue={service?.durationMinutes}
      />
      <label className={`${CHECK} sm:col-span-2`}>
        <input type="checkbox" name="active" defaultChecked={service?.isActive ?? true} className="size-5 accent-(--color-signal)" />
        {t("services.active")}
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" variant={service ? "outline" : "signal"}>
          {service ? t("services.save") : t("services.add")}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      <h1 className="type-h1">{t("services.title")}</h1>
      <p className="type-lead mt-5 max-w-2xl text-muted">{t("services.lead")}</p>

      <ul className="mt-10 border-t border-line">
        {services.map((service) => {
          const who = barbers.filter((barber) => barber.isActive && barber.serviceIds.includes(service.id)).map((barber) => barber.name);
          return (
            <li key={service.id} className="border-b border-line">
              <details>
                <summary className={SUMMARY}>
                  <span className={`type-h3 ${service.isActive ? "" : "text-muted line-through"}`}>{service.name[locale]}</span>
                  <span className="type-body tabular-nums text-muted">
                    {!service.isActive && `${t("services.retired")} · `}
                    {formatDuration(service.durationMinutes, locale)} · {formatMoney(service.priceCents, locale)}
                  </span>
                </summary>
                <p className="type-small mb-6 text-muted">{who.length ? t("services.whoDoes", { names: who.join(", ") }) : t("services.nobody")}</p>
                {source.readOnly ? (
                  <p className="type-body pb-8 text-muted">
                    {service.description[locale]} <span className="block pt-3">{t("demoReadOnly")}</span>
                  </p>
                ) : (
                  form(service)
                )}
              </details>
            </li>
          );
        })}
      </ul>

      {!source.readOnly && (
        <section aria-labelledby="add-service" className="mt-16 max-w-3xl">
          <h2 id="add-service" className="type-h2 mb-8">
            {t("services.addTitle")}
          </h2>
          {form()}
        </section>
      )}
    </>
  );
}

/** The two ranges a day can have, in the order the form shows them. */
const PARTS = ["a", "b"] as const;

function HoursEditor({ barber, locale, from, to }: { barber: AdminBarber; locale: "en" | "ru"; from: string; to: string }) {
  return (
    <ul className="border-t border-line">
      {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
        const ranges = barber.hours.filter((range) => range.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
        return (
          <li key={weekday} className="grid items-center gap-x-4 gap-y-2 border-b border-line py-3 sm:grid-cols-[8rem_1fr_1fr]">
            <span className="type-body">{formatWeekday(weekday, locale)}</span>
            {PARTS.map((part, index) => (
              <span key={part} className="type-small flex items-center gap-2 text-muted">
                {from}
                <input
                  type="time"
                  name={`hours-${weekday}-${part}-start`}
                  aria-label={`${formatWeekday(weekday, locale)}, ${index + 1}, ${from}`}
                  defaultValue={ranges[index]?.start}
                  step={1800}
                  className="scheme-dark h-11 border-b border-line bg-transparent text-fg tabular-nums"
                />
                {to}
                <input
                  type="time"
                  name={`hours-${weekday}-${part}-end`}
                  aria-label={`${formatWeekday(weekday, locale)}, ${index + 1}, ${to}`}
                  defaultValue={ranges[index]?.end}
                  step={1800}
                  className="scheme-dark h-11 border-b border-line bg-transparent text-fg tabular-nums"
                />
              </span>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

/** Each barber: public profile, what they deliver, when they work. */
export async function BarbersView({ source, locale }: AdminContext) {
  const t = await getTranslations("admin");
  const [barbers, services] = await Promise.all([source.barbers(), source.services()]);
  const offered = services.filter((service) => service.isActive);

  return (
    <>
      <h1 className="type-h1">{t("barbers.title")}</h1>

      <ul className="mt-10 border-t border-line">
        {barbers.map((barber) => (
          <li key={barber.id} className="border-b border-line">
            <details>
              <summary className={SUMMARY}>
                <span className={`type-h3 ${barber.isActive ? "" : "text-muted line-through"}`}>{barber.name}</span>
                <span className="type-body text-muted">
                  {barber.title[locale]} · {barber.isActive ? t(barber.hasAccount ? "barbers.account" : "barbers.noAccount") : t("barbers.inactive")}
                </span>
              </summary>

              {source.readOnly ? (
                <div className="type-body space-y-4 pb-8 text-muted">
                  <p>{barber.bio[locale]}</p>
                  <p>{offered.filter((service) => barber.serviceIds.includes(service.id)).map((service) => service.name[locale]).join(" · ")}</p>
                  <p className="tabular-nums">
                    {[1, 2, 3, 4, 5, 6, 7]
                      .map((weekday) => {
                        const ranges = barber.hours.filter((range) => range.weekday === weekday);
                        return ranges.length ? `${formatWeekday(weekday, locale, "short")} ${ranges.map((range) => `${range.start}–${range.end}`).join(", ")}` : null;
                      })
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p>{t("demoReadOnly")}</p>
                </div>
              ) : (
                <form action={saveBarber} className="space-y-10 pb-10">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={barber.id} />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label={t("barbers.name")} name="name" id={`name-${barber.id}`} required maxLength={80} defaultValue={barber.name} className="sm:col-span-2" />
                    <Field label={t("barbers.titleEn")} name="titleEn" id={`titleEn-${barber.id}`} required maxLength={80} defaultValue={barber.title.en} />
                    <Field label={t("barbers.titleRu")} name="titleRu" id={`titleRu-${barber.id}`} required maxLength={80} defaultValue={barber.title.ru} lang="ru" />
                    <Field label={t("barbers.bioEn")} name="bioEn" id={`bioEn-${barber.id}`} required maxLength={400} defaultValue={barber.bio.en} className="sm:col-span-2" />
                    <Field label={t("barbers.bioRu")} name="bioRu" id={`bioRu-${barber.id}`} required maxLength={400} defaultValue={barber.bio.ru} lang="ru" className="sm:col-span-2" />
                    <label className={`${CHECK} sm:col-span-2`}>
                      <input type="checkbox" name="active" defaultChecked={barber.isActive} className="size-5 accent-(--color-signal)" />
                      {t("barbers.active")}
                    </label>
                  </div>

                  <fieldset>
                    <legend className="type-eyebrow text-muted">{t("barbers.servicesTitle")}</legend>
                    <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
                      {offered.map((service) => (
                        <li key={service.id}>
                          <label className={CHECK}>
                            <input type="checkbox" name="services" value={service.id} defaultChecked={barber.serviceIds.includes(service.id)} className="size-5 accent-(--color-signal)" />
                            {service.name[locale]}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>

                  <fieldset>
                    <legend className="type-eyebrow text-muted">{t("barbers.hoursTitle")}</legend>
                    <p className="type-small mb-4 mt-2 max-w-2xl text-muted">{t("barbers.hoursNote")}</p>
                    <HoursEditor barber={barber} locale={locale} from={t("barbers.from")} to={t("barbers.to")} />
                  </fieldset>

                  <Button type="submit" variant="outline">
                    {t("barbers.save")}
                  </Button>
                </form>
              )}
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
