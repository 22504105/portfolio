"use client";

import { useTranslations } from "next-intl";
import type { Ref } from "react";
import { StepHeading, StepHint, type StepProps } from "./shared";
import { Summary } from "./Summary";

export function ReviewStep({ catalog, state, dispatch, headingRef }: StepProps & { headingRef: Ref<HTMLHeadingElement> }) {
  const t = useTranslations("booking.review");
  const { holdMinutes, changeCutoffHours } = catalog.shop.policy;
  const failed = state.result && !state.result.ok;

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

      {failed && <StepHint>{t("failed")}</StepHint>}
    </div>
  );
}
