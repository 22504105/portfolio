"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Ref } from "react";
import { addMinutes } from "@/lib/business-time";
import { totals } from "@/lib/catalog";
import type { BookingGateway } from "@/lib/booking/gateway";
import { formatDateTime } from "@/lib/format";
import { StepHeading, StepHint, type StepProps } from "./shared";
import { SlotPicker } from "./SlotPicker";

type TimeStepProps = StepProps & {
  headingRef: Ref<HTMLHeadingElement>;
  gateway: BookingGateway;
  /** The dates open for booking, "YYYY-MM-DD", today first. */
  dates: string[];
};

export function TimeStep({ catalog, state, dispatch, attempted, headingRef, gateway, dates }: TimeStepProps) {
  const t = useTranslations("booking.time");
  const locale = useLocale();

  const date = state.date ?? dates[0];
  const barberId = state.barber === "any" ? null : state.barber;
  const duration = totals(catalog.services.filter((service) => state.serviceIds.includes(service.id))).durationMinutes;

  return (
    <div>
      <StepHeading
        title={t("title")}
        lead={t("lead", { horizonDays: catalog.shop.policy.horizonDays })}
        headingRef={headingRef}
      />

      <div className="mt-10">
        <SlotPicker
          dates={dates}
          date={date}
          startsAt={state.startsAt}
          scope={`${state.barber}|${state.serviceIds.join(",")}`}
          load={(day) => gateway.getAvailability({ serviceIds: state.serviceIds, barberId, date: day })}
          onDate={(day) => dispatch({ type: "chooseDate", date: day })}
          onTime={(startsAt) => {
            if (state.date !== date) dispatch({ type: "chooseDate", date });
            dispatch({ type: "chooseTime", startsAt });
          }}
        />
      </div>

      <p className="type-small mt-6 text-muted">
        {state.startsAt &&
          `${t("ends", { time: formatDateTime(addMinutes(new Date(state.startsAt), duration), locale, { hour: "2-digit", minute: "2-digit" }) })} · `}
        {t("zone")}
      </p>

      {attempted && state.startsAt === null && <StepHint>{t("choose")}</StepHint>}
    </div>
  );
}
