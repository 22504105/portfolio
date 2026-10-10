"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Ref } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { Catalog } from "@/lib/catalog";
import { normalizeContact } from "@/lib/booking/contact";
import type { HoldResult } from "@/lib/booking/gateway";
import type { WizardState } from "@/lib/booking/wizard";
import { formatDateTime } from "@/lib/format";
import { Summary } from "./Summary";

type HeldPanelProps = {
  catalog: Catalog;
  state: WizardState;
  hold: Extract<HoldResult, { ok: true }>;
  headingRef: Ref<HTMLHeadingElement>;
  onStartOver: () => void;
};

/** The end of the wizard: the slot is held and the customer is sent to their email. */
export function HeldPanel({ catalog, state, hold, headingRef, onStartOver }: HeldPanelProps) {
  const t = useTranslations("booking.held");
  const locale = useLocale();

  return (
    <div className="grid gap-x-8 gap-y-12 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <h2 ref={headingRef} tabIndex={-1} className="type-display outline-none">
          {t("title")}
        </h2>
        <p className="type-lead mt-8 max-w-xl">
          {t("body", {
            time: formatDateTime(hold.expiresAt, locale, { hour: "2-digit", minute: "2-digit" }),
            // The address as it was submitted and as the email would be sent to.
            email: normalizeContact(state.contact).email,
          })}
        </p>
        {/* Phase 02: the mock holds nothing and sends nothing, and says so. */}
        <p className="type-body mt-6 flex max-w-xl items-baseline gap-3 border border-signal p-4">
          <span aria-hidden="true" className="size-2 shrink-0 bg-signal" />
          {t("demo")}
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button variant="solid" size="lg" onClick={onStartOver}>
            {t("another")}
          </Button>
          <ButtonLink href="/" variant="outline" size="lg">
            {t("home")}
          </ButtonLink>
        </div>
      </div>

      <div className="lg:col-span-4 lg:col-start-9">
        <p className="type-eyebrow text-muted">{t("reference")}</p>
        <p className="type-h2 mt-2 tabular-nums">{hold.reference}</p>
        <div className="mt-8">
          <Summary catalog={catalog} state={state} assignedBarberId={hold.barberId} />
        </div>
      </div>
    </div>
  );
}
