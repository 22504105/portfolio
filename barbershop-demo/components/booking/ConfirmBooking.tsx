"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { confirmBooking, type ConfirmOutcome } from "@/app/actions/booking";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { looksLikeToken } from "@/lib/booking/link-token";
import { BOOK_HREF } from "@/lib/navigation";
import { useLinkToken } from "@/lib/use-link-token";

// Confirmation takes a press of a button. Mail programs and scanners open
// links by themselves; if opening the link were enough, they would confirm
// bookings nobody meant to keep. And since the token travels after the "#",
// a scanner that only fetches the address never even receives it.
export function ConfirmBooking() {
  const t = useTranslations("booking.confirm");
  const router = useRouter();
  const token = useLinkToken();
  const [outcome, setOutcome] = useState<ConfirmOutcome | null>(null);
  const [working, startTransition] = useTransition();

  // A link with nothing that could be a token: no point asking the server.
  const failed = outcome ?? (token !== null && !looksLikeToken(token) ? "invalid" : null);

  const confirm = () =>
    startTransition(async () => {
      if (!token) return;
      const result = await confirmBooking(token);
      if (result === "confirmed") router.replace({ pathname: "/booking/manage", query: { confirmed: "1" } });
      else setOutcome(result);
    });

  if (failed === "expired" || failed === "invalid") {
    return (
      <div role="alert">
        <h1 className="type-h1 max-w-[16ch]">{t(failed === "expired" ? "expiredTitle" : "invalidTitle")}</h1>
        <p className="type-lead mt-6 max-w-xl text-muted">{t(failed === "expired" ? "expiredBody" : "invalidBody")}</p>
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
        // Until the page has read the link there is nothing to send.
        aria-disabled={working || token === null || undefined}
        aria-busy={working || undefined}
        onClick={() => !working && confirm()}
      >
        {working ? t("working") : t("button")}
      </Button>
      <noscript>
        <p className="type-body mt-6 max-w-xl">{t("needsScript")}</p>
      </noscript>
    </div>
  );
}
