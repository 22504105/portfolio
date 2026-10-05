"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/Button";
import { contact, contactMethods } from "@/data/contact";
import { cn } from "@/lib/cn";

export type Choice = {
  value: string;
  label: string;
};

type TextFieldProps = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel";
  autoComplete: ComponentProps<"input">["autoComplete"];
  error?: string;
};

type ChoiceGroupProps = {
  name: string;
  legend: string;
  choices: Choice[];
  error?: string;
};

const fieldId = (name: string) => `contact-${name}`;

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="type-small mt-3 text-ink">
      {message}
    </p>
  );
}

function TextField({ name, label, type = "text", autoComplete, error }: TextFieldProps) {
  const id = fieldId(name);
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="type-eyebrow block text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "type-lead block h-14 w-full border-b border-line-strong bg-transparent text-ink",
          "transition-colors duration-(--duration-fast) hover:border-ink focus-visible:border-ink",
          "aria-invalid:border-ink",
        )}
      />
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

function ChoiceGroup({ name, legend, choices, error }: ChoiceGroupProps) {
  const id = fieldId(name);
  const errorId = `${id}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="type-eyebrow text-ink-muted">{legend}</legend>
      <div className="isolate mt-4 flex">
        {choices.map((choice) => {
          const choiceId = `${id}-${choice.value.toLowerCase()}`;
          return (
            // Cells overlap by one pixel so neighbours share a single rule.
            <div key={choice.value} className="relative -ml-px flex-1 first:ml-0">
              <input
                id={choiceId}
                name={name}
                type="radio"
                value={choice.value}
                className="peer sr-only"
              />
              <label
                htmlFor={choiceId}
                className={cn(
                  "type-label relative flex h-14 cursor-pointer items-center justify-center border border-line-strong px-2",
                  "transition-colors duration-(--duration-fast)",
                  "peer-checked:z-10 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg",
                  "peer-focus-visible:z-20 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ink",
                )}
              >
                {choice.label}
              </label>
            </div>
          );
        })}
      </div>
      {error && <FieldError id={errorId} message={error} />}
    </fieldset>
  );
}

type ContactFormProps = {
  /** Residence options, passed in so the photography registry stays out of the client bundle. */
  residences: Choice[];
  className?: string;
};

const methodChoices: Choice[] = contactMethods.map((method) => ({ value: method, label: method }));

export function ContactForm({ residences, className }: ContactFormProps) {
  return (
    <form
      noValidate
      className={className}
      // Phase 03 replaces this with validation and the simulated submit.
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="space-y-9">
        <TextField name="name" label={contact.fields.name} autoComplete="name" />
        <TextField name="email" label={contact.fields.email} type="email" autoComplete="email" />
        <TextField name="phone" label={contact.fields.phone} type="tel" autoComplete="tel" />
      </div>

      <div className="mt-14 space-y-10">
        <ChoiceGroup name="residence" legend={contact.fields.residence} choices={residences} />
        <ChoiceGroup name="method" legend={contact.fields.method} choices={methodChoices} />
      </div>

      <div className="mt-14 flex flex-col gap-x-8 gap-y-5 sm:flex-row sm:items-center lg:max-xl:flex-col lg:max-xl:items-start">
        <Button type="submit" size="lg" className="max-sm:w-full">
          {contact.submitLabel}
        </Button>
        <p className="type-small max-w-xs text-ink-muted">{contact.disclosure}</p>
      </div>
    </form>
  );
}
