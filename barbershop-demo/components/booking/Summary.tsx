"use client";

import { useLocale, useTranslations } from "next-intl";
import { totals, type Catalog } from "@/lib/catalog";
import type { Step, WizardState } from "@/lib/booking/wizard";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";

type SummaryProps = {
  catalog: Catalog;
  state: WizardState;
  /** Given on the review step: each part then gets a link back to its step. */
  onEdit?: (step: Step) => void;
  /** The barber assigned once the slot is held, when "Any available" was chosen. */
  assignedBarberId?: string;
};

/** What has been chosen so far, with the total time and price. */
export function Summary({ catalog, state, onEdit, assignedBarberId }: SummaryProps) {
  const t = useTranslations("booking");
  const locale = useLocale();

  const services = catalog.services.filter((service) => state.serviceIds.includes(service.id));
  const { priceCents, durationMinutes } = totals(services);
  const barberId = assignedBarberId ?? (state.barber === "any" ? null : state.barber);
  const barber = catalog.barbers.find((candidate) => candidate.id === barberId);
  const none = <span className="text-muted">{t("summary.notChosen")}</span>;

  const edit = (step: Step) =>
    onEdit && (
      <button
        type="button"
        className="type-label -my-2 inline-flex min-h-11 shrink-0 items-center border-b border-transparent text-muted transition-colors duration-(--duration-fast) hover:text-signal"
        onClick={() => onEdit(step)}
      >
        {t("edit")}
        <span className="sr-only">: {t(`steps.${step}`)}</span>
      </button>
    );

  const row = "flex items-start justify-between gap-4 border-b border-line py-4";

  return (
    <dl className="type-body border-t border-line">
      <div className={row}>
        <div className="min-w-0 flex-1">
          <dt className="type-eyebrow text-muted">{t("summary.services")}</dt>
          <dd className="mt-2">
            {services.length === 0
              ? none
              : services.map((service) => (
                  <span key={service.id} className="flex justify-between gap-4">
                    <span>{service.name[locale]}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(service.priceCents, locale)}</span>
                  </span>
                ))}
          </dd>
        </div>
        {edit("services")}
      </div>

      <div className={row}>
        <div>
          <dt className="type-eyebrow text-muted">{t("summary.barber")}</dt>
          <dd className="mt-2">{barber ? barber.name : state.barber === "any" ? t("barber.any") : none}</dd>
        </div>
        {edit("barber")}
      </div>

      <div className={row}>
        <div>
          <dt className="type-eyebrow text-muted">{t("summary.when")}</dt>
          <dd className="mt-2">
            {state.startsAt ? (
              <>
                <span className="block">
                  {formatDateTime(state.startsAt, locale, { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <span className="block tabular-nums">
                  {formatDateTime(state.startsAt, locale, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            ) : (
              none
            )}
          </dd>
        </div>
        {edit("time")}
      </div>

      {onEdit && (
        <div className={row}>
          <div className="min-w-0">
            <dt className="type-eyebrow text-muted">{t("summary.contact")}</dt>
            <dd className="mt-2 break-words">
              <span className="block">{state.contact.name}</span>
              <span className="block">{state.contact.email}</span>
              <span className="block">{state.contact.phone}</span>
            </dd>
          </div>
          {edit("details")}
        </div>
      )}

      <div className="flex items-baseline justify-between gap-4 border-b border-line py-4">
        <dt className="type-eyebrow text-muted">{t("summary.duration")}</dt>
        <dd className="tabular-nums">{services.length ? formatDuration(durationMinutes, locale) : "—"}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 py-4">
        <dt className="type-eyebrow text-muted">{t("summary.total")}</dt>
        <dd className="type-h2 tabular-nums">{formatMoney(priceCents, locale)}</dd>
      </div>
    </dl>
  );
}
