"use client";

import { useTranslations } from "next-intl";
import type { Ref } from "react";
import { StepHeading, StepHint, type StepProps } from "./shared";
import { Summary } from "./Summary";

export function ReviewStep({ catalog, state, dispatch, headingRef }: StepProps & { headingRef: Ref<HTMLHeadingElement> }) {
  const t = useTranslations("booking.review");
  const { holdMinutes, changeCutoffHours } = catalog.shop.policy;
  // A slot that has gone is reported on the time step, where the customer is sent.
  const failure = state.result && !state.result.ok && state.result.code !== "slot_taken" ? state.result.code : null;

  return (
    <div>
      <StepHeading title={t("title")} lead={t("lead")} headingRef={headingRef} />

      <div className="mt-10">
        <Summary catalog={catalog} state={state} onEdit={(step) => dispatch({ type: "goTo", step })} />
      </div>

      <ul className="type-small mt-8 space-y-2 text-muted">
        <li>{t("terms1", { holdMinutes })}</li>
        <li>{t("terms2", { cutoffHours: changeCutoffHours })}</li>
        <li>{t("terms3")}</li>
      </ul>

      {failure && (
        <StepHint>{t(failure === "too_many_holds" ? "tooManyHolds" : failure === "invalid" ? "invalid" : "failed")}</StepHint>
      )}
    </div>
  );
}
