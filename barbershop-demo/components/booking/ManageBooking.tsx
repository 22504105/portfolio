"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cancelBooking, fetchRescheduleAvailability, rescheduleBooking } from "@/app/actions/booking";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { businessDate } from "@/lib/business-time";
import type { ChangeRefusal } from "@/lib/booking/store";
import { StepHint } from "./shared";
import { SlotPicker } from "./SlotPicker";

type ManageBookingProps = {
  /** ISO instant of the current start. */
  startsAt: string;
  /** The dates open for booking, "YYYY-MM-DD", today first. */
  dates: string[];
  cutoffHours: number;
};

type Panel = "closed" | "reschedule" | "cancel";

/** The two things a customer can do to a confirmed booking: move it or cancel it. */
export function ManageBooking({ startsAt, dates, cutoffHours }: ManageBookingProps) {
  const t = useTranslations("booking.manage");
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("closed");
  const currentDate = businessDate(new Date(startsAt));
  const [date, setDate] = useState(dates.includes(currentDate) ? currentDate : dates[0]);
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState<ChangeRefusal | "choose" | null>(null);
  const [moved, setMoved] = useState(false);
  const [working, startTransition] = useTransition();
  // Bumped after a refusal so the picker asks again: a time that was taken must disappear.
  const [round, setRound] = useState(0);

  const open = (next: Panel) => {
    setPanel(next);
    setError(null);
    setMoved(false);
  };

  const move = () => {
    if (working) return;
    if (!choice || choice === startsAt) return setError("choose");
    startTransition(async () => {
      const result = await rescheduleBooking(choice);
      if (result.ok) {
        setPanel("closed");
        setChoice(null);
        setError(null);
        setMoved(true);
        router.refresh();
      } else {
        setError(result.code);
        setChoice(null);
        setRound((count) => count + 1);
      }
    });
  };

  const cancel = () => {
    if (working) return;
    startTransition(async () => {
      const result = await cancelBooking();
      if (result.ok) router.refresh();
      else setError(result.code);
    });
  };

  return (
    <section aria-labelledby="change-title" className="mt-14">
      <h2 id="change-title" className="type-h2">
        {t("changeTitle")}
      </h2>
      <p className="type-body mt-4 max-w-xl text-muted">{t("changeNote", { hours: cutoffHours })}</p>

      {/* Always in the document, so the result of an action is announced. */}
      <div role="status">{moved && <p className="type-body mt-6 font-medium">{t("rescheduleDone")}</p>}</div>

      {panel === "closed" && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="solid" size="lg" onClick={() => open("reschedule")}>
            {t("rescheduleButton")}
          </Button>
          <Button variant="outline" size="lg" onClick={() => open("cancel")}>
            {t("cancelButton")}
          </Button>
        </div>
      )}

      {panel === "reschedule" && (
        <div className="mt-8 border-t border-line pt-8">
          <h3 className="type-h3">{t("rescheduleTitle")}</h3>
          <p className="type-body mt-3 max-w-xl text-muted">{t("rescheduleLead")}</p>
          <div className="mt-8">
            <SlotPicker
              prefix="move-"
              dates={dates}
              date={date}
              startsAt={choice ?? startsAt}
              scope={String(round)}
              load={fetchRescheduleAvailability}
              onDate={(day) => {
                setDate(day);
                setChoice(null);
              }}
              onTime={(start) => {
                setChoice(start);
                setError(null);
              }}
            />
          </div>
          {error && <StepHint>{error === "choose" ? t("rescheduleChoose") : t(`errors.${error}`)}</StepHint>}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="signal" size="lg" aria-disabled={working || undefined} aria-busy={working || undefined} onClick={move}>
              {working ? t("rescheduleWorking") : t("rescheduleSubmit")}
            </Button>
            <Button variant="outline" size="lg" aria-disabled={working || undefined} onClick={() => !working && open("closed")}>
              {t("keep")}
            </Button>
          </div>
        </div>
      )}

      {panel === "cancel" && (
        <div className="mt-8 border border-line p-6 md:p-8">
          <h3 className="type-h3">{t("cancelTitle")}</h3>
          <p className="type-body mt-3 max-w-xl text-muted">{t("cancelBody")}</p>
          {error && error !== "choose" && <StepHint>{t(`errors.${error}`)}</StepHint>}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="solid" size="lg" aria-disabled={working || undefined} aria-busy={working || undefined} onClick={cancel}>
              {working ? t("cancelWorking") : t("cancelConfirm")}
            </Button>
            <Button variant="outline" size="lg" aria-disabled={working || undefined} onClick={() => !working && open("closed")}>
              {t("keep")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
