"use client";

import { useTranslations } from "next-intl";
import { useState, type ComponentProps, type Ref } from "react";
import { validateContact, type ContactField } from "@/lib/booking/contact";
import { StepHeading, StepHint, type StepProps } from "./shared";

const FIELDS: { name: ContactField; type: "text" | "email" | "tel"; autoComplete: ComponentProps<"input">["autoComplete"] }[] = [
  { name: "name", type: "text", autoComplete: "name" },
  { name: "email", type: "email", autoComplete: "email" },
  { name: "phone", type: "tel", autoComplete: "tel" },
];

export function DetailsStep({ state, dispatch, attempted, headingRef }: StepProps & { headingRef: Ref<HTMLHeadingElement> }) {
  const t = useTranslations("booking.details");
  // A field is checked once it has been left, or once the customer has tried to continue.
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const errors = validateContact(state.contact);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div>
      <StepHeading title={t("title")} lead={t("lead")} headingRef={headingRef} />

      <div className="mt-10 space-y-8">
        {FIELDS.map(({ name, type, autoComplete }) => {
          const issue = attempted || touched[name] ? errors[name] : undefined;
          const id = `contact-${name}`;
          return (
            <div key={name}>
              <label htmlFor={id} className="type-eyebrow block text-muted">
                {t(name)}
              </label>
              <input
                id={id}
                name={name}
                type={type}
                autoComplete={autoComplete}
                required
                value={state.contact[name]}
                aria-invalid={issue ? true : undefined}
                aria-describedby={issue ? `${id}-error` : undefined}
                onChange={(event) => dispatch({ type: "setContact", contact: { ...state.contact, [name]: event.target.value } })}
                onBlur={() => setTouched((current) => ({ ...current, [name]: true }))}
                className="type-lead mt-1 block h-14 w-full border-b border-line bg-transparent text-fg transition-colors duration-(--duration-fast) hover:border-fg focus-visible:border-signal focus-visible:outline-none aria-invalid:border-b-2 aria-invalid:border-signal"
              />
              {issue && (
                <p id={`${id}-error`} className="type-small mt-2 flex items-baseline gap-3 font-medium">
                  <span aria-hidden="true" className="size-2 shrink-0 bg-signal" />
                  {t(`errors.${name}.${issue}`)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="type-small mt-8 max-w-md text-muted">{t("privacy")}</p>
      {attempted && hasErrors && <StepHint>{t("fix")}</StepHint>}
    </div>
  );
}
