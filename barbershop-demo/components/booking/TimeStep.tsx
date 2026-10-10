"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { addMinutes, zonedInstant } from "@/lib/business-time";
import { totals } from "@/lib/catalog";
import type { BookingGateway, Slot } from "@/lib/booking/gateway";
import { formatDateTime } from "@/lib/format";
import { StepHeading, StepHint, type StepProps } from "./shared";

type TimeStepProps = StepProps & {
  headingRef: Ref<HTMLHeadingElement>;
  gateway: BookingGateway;
  /** The dates open for booking, "YYYY-MM-DD", today first. */
  dates: string[];
};

/** The answer to one availability request; `key` says which request it answers. */
type Answer = { key: string; slots: Slot[] | null };

const CLOCK = { hour: "2-digit", minute: "2-digit" } as const;

const TILE =
  "flex cursor-pointer flex-col items-center justify-center border border-line transition-colors duration-(--duration-fast) " +
  "hover:border-fg peer-checked:border-signal peer-checked:bg-signal peer-checked:text-ink " +
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal";

export function TimeStep({ catalog, state, dispatch, attempted, headingRef, gateway, dates }: TimeStepProps) {
  const t = useTranslations("booking.time");
  const locale = useLocale();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);

  const date = state.date ?? dates[0];
  const barberId = state.barber === "any" ? null : state.barber;
  const key = [date, state.barber, state.serviceIds.join(","), attempt].join("|");

  useEffect(() => {
    let stale = false;
    gateway.getAvailability({ serviceIds: state.serviceIds, barberId, date }).then(
      (slots) => !stale && setAnswer({ key, slots }),
      () => !stale && setAnswer({ key, slots: null }),
    );
    return () => {
      stale = true;
    };
    // `key` stands for everything the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, gateway]);

  // Until the answer to the current request arrives, the step is loading.
  const current = answer?.key === key ? answer : null;
  const duration = totals(catalog.services.filter((service) => state.serviceIds.includes(service.id))).durationMinutes;

  const chooseTime = (startsAt: string) => {
    if (state.date !== date) dispatch({ type: "chooseDate", date });
    dispatch({ type: "chooseTime", startsAt });
  };

  return (
    <div>
      <StepHeading
        title={t("title")}
        lead={t("lead", { horizonDays: catalog.shop.policy.horizonDays })}
        headingRef={headingRef}
      />

      <fieldset className="mt-10 min-w-0">
        <legend className="type-eyebrow text-muted">{t("dateLabel")}</legend>
        {/*
          A strip that scrolls sideways; the arrow keys move through the days.
          Each item is `relative` so its visually hidden radio button stays
          inside the strip instead of widening the page.
        */}
        <ul className="-mx-gutter mt-4 flex gap-2 overflow-x-auto px-gutter pb-3 pt-1">
          {dates.map((day, index) => {
            const noon = zonedInstant(day, "12:00");
            return (
              <li key={day} className="relative shrink-0">
                <input
                  id={`date-${day}`}
                  type="radio"
                  name="date"
                  className="peer sr-only"
                  checked={day === date}
                  onChange={() => dispatch({ type: "chooseDate", date: day })}
                />
                <label
                  htmlFor={`date-${day}`}
                  aria-label={formatDateTime(noon, locale, { weekday: "long", day: "numeric", month: "long" })}
                  className={`${TILE} h-20 min-w-16 gap-1 px-2`}
                >
                  <span className="type-eyebrow">
                    {index === 0 ? t("today") : formatDateTime(noon, locale, { weekday: "short" })}
                  </span>
                  <span className="type-h3 tabular-nums">{formatDateTime(noon, locale, { day: "numeric" })}</span>
                  <span className="type-eyebrow opacity-70">{formatDateTime(noon, locale, { month: "short" })}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="mt-8 min-w-0" aria-busy={current === null}>
        <legend className="type-eyebrow text-muted">{t("timeLabel")}</legend>

        {/* Always in the document, so a change of state is announced. */}
        <div role="status" className="mt-4">
          {current === null && <p className="type-body text-muted">{t("loading")}</p>}
          {current?.slots?.length === 0 && (
            <>
              <p className="type-body">{t("empty")}</p>
              <p className="type-small mt-2 max-w-md text-muted">{t("emptyHint")}</p>
            </>
          )}
          {current && current.slots === null && (
            <>
              <p className="type-body">{t("error")}</p>
              <Button variant="outline" className="mt-4" onClick={() => setAttempt((count) => count + 1)}>
                {t("retry")}
              </Button>
            </>
          )}
        </div>

        {current?.slots && current.slots.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {current.slots.map((slot) => (
              <li key={slot.startsAt} className="relative">
                <input
                  id={`slot-${slot.startsAt}`}
                  type="radio"
                  name="slot"
                  className="peer sr-only"
                  checked={slot.startsAt === state.startsAt}
                  onChange={() => chooseTime(slot.startsAt)}
                />
                <label htmlFor={`slot-${slot.startsAt}`} className={`${TILE} type-h3 h-14 tabular-nums`}>
                  {formatDateTime(slot.startsAt, locale, CLOCK)}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <p className="type-small mt-6 text-muted">
        {state.startsAt &&
          `${t("ends", { time: formatDateTime(addMinutes(new Date(state.startsAt), duration), locale, CLOCK) })} · `}
        {t("zone")}
      </p>

      {attempted && state.startsAt === null && <StepHint>{t("choose")}</StepHint>}
    </div>
  );
}
