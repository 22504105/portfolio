"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Ref } from "react";
import { eligibleBarbers } from "@/lib/catalog";
import type { BarberChoice } from "@/lib/booking/wizard";
import { CHOICE_ROW, ChoiceMark, StepHeading, StepHint, type StepProps } from "./shared";

export function BarberStep({ catalog, state, dispatch, attempted, headingRef }: StepProps & { headingRef: Ref<HTMLHeadingElement> }) {
  const t = useTranslations("booking.barber");
  const locale = useLocale();

  // Only barbers who do everything that was chosen are offered.
  const options: { value: BarberChoice; name: string; note: string }[] = [
    { value: "any", name: t("any"), note: t("anyNote") },
    ...eligibleBarbers(catalog.barbers, state.serviceIds).map((barber) => ({
      value: barber.id,
      name: barber.name,
      note: barber.title[locale],
    })),
  ];

  return (
    <fieldset>
      <legend className="sr-only">{t("title")}</legend>
      <StepHeading title={t("title")} lead={t("lead")} headingRef={headingRef} />

      <ul className="mt-10 border-t border-line">
        {options.map((option) => (
          <li key={option.value} className="group relative">
            <input
              id={`barber-${option.value}`}
              type="radio"
              name="barber"
              className="peer sr-only"
              checked={state.barber === option.value}
              onChange={() => dispatch({ type: "chooseBarber", barber: option.value })}
            />
            <label htmlFor={`barber-${option.value}`} className={CHOICE_ROW}>
              <ChoiceMark round />
              <span className="min-w-0 flex-1">
                <span className="type-h3 block">{option.name}</span>
                <span className="type-small mt-1 block text-muted">{option.note}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {attempted && state.barber === null && <StepHint>{t("choose")}</StepHint>}
    </fieldset>
  );
}
