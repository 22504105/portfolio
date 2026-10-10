"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { totals, type Catalog } from "@/lib/catalog";
import { normalizeContact, type Contact } from "@/lib/booking/contact";
import { liveGateway } from "@/lib/booking/live-gateway";
import { createMockGateway } from "@/lib/booking/mock-gateway";
import { bookableDates } from "@/lib/booking/slots";
import { initialState, isComplete, reduce, STEPS, type Step, type WizardAction, type WizardState } from "@/lib/booking/wizard";
import { formatDuration, formatMoney } from "@/lib/format";
import { BarberStep } from "./BarberStep";
import { DetailsStep } from "./DetailsStep";
import { HeldPanel } from "./HeldPanel";
import { ReviewStep } from "./ReviewStep";
import { ServicesStep } from "./ServicesStep";
import { StepHint } from "./shared";
import { Stepper } from "./Stepper";
import { Summary } from "./Summary";
import { TimeStep } from "./TimeStep";

type BookingWizardProps = {
  catalog: Catalog;
  /** A service or barber named by the link that opened the page. */
  preselection: { serviceId?: string; barberId?: string; contact?: Contact };
  /**
   * True when a database is configured: the wizard then talks to the booking
   * engine. False shows the same interface on a mock, as a preview.
   */
  live: boolean;
};

export function BookingWizard({ catalog, preselection, live }: BookingWizardProps) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [state, dispatch] = useReducer(
    (current: WizardState, action: WizardAction) => reduce(current, action, catalog),
    undefined,
    () => initialState(catalog, preselection),
  );
  const gateway = useMemo(() => (live ? liveGateway : createMockGateway(catalog)), [live, catalog]);
  const [dates] = useState(() => bookableDates(new Date(), catalog.shop.policy.horizonDays));
  // The step on which the customer pressed Continue with something missing.
  const [attemptedStep, setAttemptedStep] = useState<Step | null>(null);

  // Each new step, and the final screen, starts with focus on its heading.
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const held = state.status === "held";
  useEffect(() => {
    if (mounted.current) heading.current?.focus();
    mounted.current = true;
  }, [state.step, held]);

  if (state.status === "held" && state.result?.ok) {
    return (
      <HeldPanel
        catalog={catalog}
        state={state}
        hold={state.result}
        preview={!live}
        headingRef={heading}
        onStartOver={() => dispatch({ type: "startOver" })}
      />
    );
  }

  const submitting = state.status === "submitting";
  const onReview = state.step === "review";
  const step = { catalog, state, dispatch, attempted: attemptedStep === state.step, headingRef: heading };
  const { priceCents, durationMinutes } = totals(catalog.services.filter((service) => state.serviceIds.includes(service.id)));

  const submit = async () => {
    if (!state.startsAt || state.barber === null) return;
    dispatch({ type: "submit" });
    try {
      const result = await gateway.createHold({
        serviceIds: state.serviceIds,
        barberId: state.barber === "any" ? null : state.barber,
        startsAt: state.startsAt,
        contact: normalizeContact(state.contact),
        locale,
      });
      dispatch({ type: "submitted", result });
    } catch {
      dispatch({ type: "submitted", result: { ok: false, code: "unavailable" } });
    }
  };

  const onContinue = () => {
    if (submitting) return;
    if (!isComplete(state.step, state, catalog) && !onReview) {
      setAttemptedStep(state.step);
      return;
    }
    setAttemptedStep(null);
    if (onReview) void submit();
    else dispatch({ type: "next" });
  };

  return (
    <div className="grid gap-x-8 gap-y-10 lg:grid-cols-12">
      {/* min-w-0: lets the date strip scroll inside the column instead of widening the page. */}
      <div className="min-w-0 lg:col-span-7">
        <Stepper catalog={catalog} state={state} onOpen={(target) => dispatch({ type: "goTo", step: target })} />

        <div className="mt-10 md:mt-14">
          {state.result?.ok === false && state.result.code === "slot_taken" && state.step === "time" && (
            <div className="mb-8">
              <StepHint>{t("review.slotTaken")}</StepHint>
            </div>
          )}

          {state.step === "services" && <ServicesStep {...step} />}
          {state.step === "barber" && <BarberStep {...step} />}
          {state.step === "time" && <TimeStep {...step} gateway={gateway} dates={dates} />}
          {state.step === "details" && <DetailsStep {...step} />}
          {state.step === "review" && <ReviewStep {...step} />}
        </div>

        {/* Stays in reach at the bottom of the screen; on a phone it also carries the running total. */}
        <div className="sticky bottom-0 z-10 -mx-gutter mt-12 border-t border-line bg-ink px-gutter py-4">
          {state.serviceIds.length > 0 && (
            <p className="type-small mb-3 flex justify-between gap-4 tabular-nums lg:hidden">
              <span className="text-muted">
                {t("summary.total")} · {formatDuration(durationMinutes, locale)}
              </span>
              <span>{formatMoney(priceCents, locale)}</span>
            </p>
          )}
          <div className="flex gap-3">
            {state.step !== STEPS[0] && (
              <Button variant="outline" size="lg" aria-disabled={submitting || undefined} onClick={() => dispatch({ type: "back" })}>
                {t("back")}
              </Button>
            )}
            <Button
              variant="signal"
              size="lg"
              className="flex-1 sm:flex-none sm:min-w-56"
              aria-disabled={submitting || undefined}
              aria-busy={submitting || undefined}
              onClick={onContinue}
            >
              {onReview ? (submitting ? t("review.submitting") : t("review.submit")) : t("continue")}
            </Button>
          </div>
        </div>
      </div>

      {/* On the review step the summary is the step itself. */}
      {!onReview && (
        <aside aria-labelledby="summary-title" className="max-lg:hidden lg:col-span-4 lg:col-start-9">
          <div className="sticky top-[calc(var(--spacing-header)+2rem)]">
            <h2 id="summary-title" className="type-eyebrow mb-4 text-muted">
              {t("summary.title")}
            </h2>
            <Summary catalog={catalog} state={state} />
          </div>
        </aside>
      )}
    </div>
  );
}
