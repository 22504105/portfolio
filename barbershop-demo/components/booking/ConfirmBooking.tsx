"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { confirmBooking, type ConfirmOutcome } from "@/app/actions/booking";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { BOOK_HREF } from "@/lib/navigation";

type ConfirmBookingProps = {
  token: string;
  /** False when the link carries nothing that could be a token: no point asking the server. */
  plausible: boolean;
};

// Confirmation takes a press of a button. Mail programs and scanners open
// links by themselves; if opening the link were enough, they would confirm
// bookings nobody meant to keep.
export function ConfirmBooking({ token, plausible }: ConfirmBookingProps) {
  const t = useTranslations("booking.confirm");
  const router = useRouter();
  const [outcome, setOutcome] = useState<ConfirmOutcome | null>(plausible ? null : "invalid");
  const [working, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmBooking(token);
      if (result === "confirmed") router.replace({ pathname: "/booking/manage", query: { confirmed: "1" } });
      else setOutcome(result);
    });

  if (outcome === "expired" || outcome === "invalid") {
    return (
      <div role="alert">
        <h1 className="type-h1 max-w-[16ch]">{t(outcome === "expired" ? "expiredTitle" : "invalidTitle")}</h1>
        <p className="type-lead mt-6 max-w-xl text-muted">{t(outcome === "expired" ? "expiredBody" : "invalidBody")}</p>
        <ButtonLink href={BOOK_HREF} variant="signal" size="lg" className="mt-10">
          {t("bookAgain")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <h1 className="type-h1 max-w-[16ch]">{t("title")}</h1>
      <p className="type-lead mt-6 max-w-xl text-muted">{t("lead")}</p>
      <Button
        variant="signal"
        size="lg"
        className="mt-10"
        aria-disabled={working || undefined}
        aria-busy={working || undefined}
        onClick={() => !working && confirm()}
      >
        {working ? t("working") : t("button")}
      </Button>
    </div>
  );
}
