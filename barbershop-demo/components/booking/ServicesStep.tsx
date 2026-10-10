"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Ref } from "react";
import { eligibleBarbers } from "@/lib/catalog";
import { formatDuration, formatMoney } from "@/lib/format";
import { CHOICE_ROW, ChoiceMark, StepHeading, StepHint, type StepProps } from "./shared";

export function ServicesStep({ catalog, state, dispatch, attempted, headingRef }: StepProps & { headingRef: Ref<HTMLHeadingElement> }) {
  const t = useTranslations("booking.services");
  const locale = useLocale();
  const nobodyDoesAll = state.serviceIds.length > 0 && eligibleBarbers(catalog.barbers, state.serviceIds).length === 0;

  return (
    <fieldset>
      <legend className="sr-only">{t("title")}</legend>
      <StepHeading title={t("title")} lead={t("lead")} headingRef={headingRef} />

      <ul className="mt-10 border-t border-line">
        {catalog.services.map((service) => (
          <li key={service.id} className="group relative">
            <input
              id={`service-${service.id}`}
              type="checkbox"
              className="peer sr-only"
              checked={state.serviceIds.includes(service.id)}
              onChange={() => dispatch({ type: "toggleService", id: service.id })}
            />
            <label htmlFor={`service-${service.id}`} className={CHOICE_ROW}>
              <ChoiceMark />
              <span className="min-w-0 flex-1">
                <span className="type-h3 block">{service.name[locale]}</span>
                <span className="type-small mt-1 block text-muted">{service.description[locale]}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="type-h3 block tabular-nums">{formatMoney(service.priceCents, locale)}</span>
                <span className="type-small mt-1 block text-muted">{formatDuration(service.durationMinutes, locale)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {nobodyDoesAll && <StepHint>{t("noBarber")}</StepHint>}
      {attempted && state.serviceIds.length === 0 && <StepHint>{t("chooseOne")}</StepHint>}
    </fieldset>
  );
}
