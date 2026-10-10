"use client";

import { useTranslations } from "next-intl";
import type { Catalog } from "@/lib/catalog";
import { canOpen, STEPS, type Step, type WizardState } from "@/lib/booking/wizard";

type StepperProps = {
  catalog: Catalog;
  state: WizardState;
  onOpen: (step: Step) => void;
};

/** Where the customer is in the booking, and a way back to any step already done. */
export function Stepper({ catalog, state, onOpen }: StepperProps) {
  const t = useTranslations("booking");
  const currentIndex = STEPS.indexOf(state.step);

  return (
    <nav aria-label={t("stepsLabel")}>
      <p className="type-eyebrow text-muted md:hidden">
        {t("stepOf", { current: currentIndex + 1, total: STEPS.length })} · {t(`steps.${state.step}`)}
      </p>
      <ol className="mt-3 flex gap-1 md:mt-0 md:gap-2">
        {STEPS.map((step, index) => {
          const current = step === state.step;
          const reachable = !current && canOpen(step, state, catalog);
          const label = (
            <>
              <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <span className="max-md:sr-only">{t(`steps.${step}`)}</span>
            </>
          );
          const shape = `type-label flex w-full items-center gap-3 border-t-2 pt-3 text-left md:min-h-11 ${
            current ? "border-signal text-fg" : index < currentIndex ? "border-fg text-fg" : "border-line text-muted"
          }`;

          return (
            <li key={step} className="flex-1" aria-current={current ? "step" : undefined}>
              {reachable ? (
                <button type="button" className={`${shape} transition-colors duration-(--duration-fast) hover:text-signal`} onClick={() => onOpen(step)}>
                  {label}
                </button>
              ) : (
                <span className={shape}>{label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
