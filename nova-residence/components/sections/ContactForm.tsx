"use client";

import * as m from "motion/react-m";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, FormEvent } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/Button";
import { contact, contactMethods } from "@/data/contact";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";
import { useViewingRequest } from "./ViewingRequest";

type Choice = {
  value: string;
  label: string;
};

// In the order of the form, which is the order errors are looked for.
const FIELDS = ["name", "email", "phone", "residence", "method"] as const;

type Field = (typeof FIELDS)[number];
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { name: "", email: "", phone: "", residence: "", method: "" };

/** How long the pretend request takes, in milliseconds. */
const REQUEST_DELAY = 1200;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Permissive on purpose: numbers are written in many ways.
const PHONE = /^[\d\s+\-()]+$/;
const PHONE_MIN_DIGITS = 7;

function validate(values: Values): Errors {
  const errors: Errors = {};
  const email = values.email.trim();
  const phone = values.phone.trim();

  if (!values.name.trim()) errors.name = contact.errors.name;

  if (!email) errors.email = contact.errors.emailMissing;
  else if (!EMAIL.test(email)) errors.email = contact.errors.emailInvalid;

  if (!phone) errors.phone = contact.errors.phoneMissing;
  else if (!PHONE.test(phone) || phone.replace(/\D/g, "").length < PHONE_MIN_DIGITS) {
    errors.phone = contact.errors.phoneInvalid;
  }

  if (!values.residence) errors.residence = contact.errors.residence;
  if (!values.method) errors.method = contact.errors.method;

  return errors;
}

type FieldProps = {
  name: Field;
  value: string;
  error?: string;
  onChange: (name: Field, value: string) => void;
};

type TextFieldProps = FieldProps & {
  label: string;
  type?: "text" | "email" | "tel";
  autoComplete: ComponentProps<"input">["autoComplete"];
};

type ChoiceGroupProps = FieldProps & {
  legend: string;
  choices: Choice[];
};

const fieldId = (name: string) => `contact-${name}`;

/** The control of a field; for a group of choices, the first of them. */
const control = (form: HTMLFormElement | null, name: Field) =>
  form?.querySelector<HTMLElement>(`[name="${name}"]`);

// There is no error colour in the palette: an error is said in ink at medium
// weight behind a small solid mark, and the field itself takes an ink rule.
function ErrorMessage({ id, message, className }: { id?: string; message: string; className: string }) {
  return (
    <p id={id} className={cn("type-small flex items-baseline gap-2.5 font-medium text-ink", className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 -translate-y-px bg-ink" />
      {message}
    </p>
  );
}

function TextField({ name, label, type = "text", autoComplete, value, error, onChange }: TextFieldProps) {
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
        required
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "type-lead block h-14 w-full border-b border-line-strong bg-transparent text-ink",
          "transition-colors duration-(--duration-fast) hover:border-ink focus-visible:border-ink",
          // The ring sits on the edge of the field, clear of the label above it.
          "focus-visible:outline-offset-0 aria-invalid:border-b-2 aria-invalid:border-ink",
        )}
      />
      {error && <ErrorMessage id={errorId} message={error} className="mt-3" />}
    </div>
  );
}

function ChoiceGroup({ name, legend, choices, value, error, onChange }: ChoiceGroupProps) {
  const id = fieldId(name);
  const errorId = `${id}-error`;

  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      data-invalid={error ? "" : undefined}
      className="group/choices"
    >
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
                required
                checked={value === choice.value}
                onChange={() => onChange(name, choice.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={choiceId}
                className={cn(
                  "type-label relative flex h-14 cursor-pointer items-center justify-center border border-line-strong px-2",
                  "transition-colors duration-(--duration-fast) hover:border-ink",
                  "group-data-invalid/choices:border-ink",
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
      {error && <ErrorMessage id={errorId} message={error} className="mt-3" />}
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
  const form = useRef<HTMLFormElement>(null);
  const thanks = useRef<HTMLHeadingElement>(null);
  const request = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [viewingRequests, setViewingRequests] = useState(0);
  const { listen } = useViewingRequest();

  useEffect(() => () => clearTimeout(request.current), []);

  // The note takes the top of the column, usually above the button just pressed.
  useEffect(() => {
    if (status !== "sent") return;
    thanks.current?.focus({ preventScroll: true });
    thanks.current?.scrollIntoView({ block: "center" });
  }, [status]);

  // A viewing requested from the residence details: start a fresh request for
  // that residence. The form may be hidden behind the thank-you note, so focus
  // waits for the render that brings it back.
  useEffect(
    () =>
      listen((residence) => {
        clearTimeout(request.current);
        setStatus("idle");
        setValues((current) => ({ ...current, residence }));
        setErrors((current) => ({ ...current, residence: undefined }));
        setViewingRequests((count) => count + 1);
      }),
    [listen],
  );

  useEffect(() => {
    if (viewingRequests === 0) return;
    form.current?.closest("section")?.scrollIntoView();
    control(form.current, "name")?.focus({ preventScroll: true });
  }, [viewingRequests]);

  // A field is checked again as it is corrected, but not before it has failed once.
  const onChange = (name: Field, value: string) => {
    const next = { ...values, [name]: value };
    setValues(next);
    if (errors[name]) setErrors({ ...errors, [name]: validate(next)[name] });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (status !== "idle") return;

    const found = validate(values);
    const firstInvalid = FIELDS.find((name) => found[name]);
    if (firstInvalid) {
      // The messages change the layout, so they are on the page before the
      // first of them is scrolled to; centred, its label and message show too.
      flushSync(() => setErrors(found));
      const invalid = control(form.current, firstInvalid);
      invalid?.focus({ preventScroll: true });
      invalid?.scrollIntoView({ block: "center" });
      return;
    }
    setErrors(found);

    setStatus("submitting");
    request.current = setTimeout(() => {
      setStatus("sent");
      setValues(EMPTY);
    }, REQUEST_DELAY);
  };

  const submitting = status === "submitting";
  const sent = status === "sent";
  const hasErrors = FIELDS.some((name) => errors[name]);

  return (
    // The form and the thank-you note share one cell. From lg the form stays in
    // place, inert and transparent, so the column keeps its height beside the
    // photograph when the note replaces it; below lg nothing stands beside it and
    // the column closes up around the note. Not `invisible`: the reduced-motion
    // rule in globals.css makes visibility change a moment late, and the form
    // could not take focus on return.
    <div className={cn("grid", className)}>
      <form
        ref={form}
        noValidate
        inert={sent}
        className={cn("col-start-1 row-start-1", sent && "opacity-0 max-lg:hidden")}
        onSubmit={onSubmit}
      >
        <div className="space-y-9">
          <TextField
            name="name"
            label={contact.fields.name}
            autoComplete="name"
            value={values.name}
            error={errors.name}
            onChange={onChange}
          />
          <TextField
            name="email"
            label={contact.fields.email}
            type="email"
            autoComplete="email"
            value={values.email}
            error={errors.email}
            onChange={onChange}
          />
          <TextField
            name="phone"
            label={contact.fields.phone}
            type="tel"
            autoComplete="tel"
            value={values.phone}
            error={errors.phone}
            onChange={onChange}
          />
        </div>

        <div className="mt-14 space-y-10">
          <ChoiceGroup
            name="residence"
            legend={contact.fields.residence}
            choices={residences}
            value={values.residence}
            error={errors.residence}
            onChange={onChange}
          />
          <ChoiceGroup
            name="method"
            legend={contact.fields.method}
            choices={methodChoices}
            value={values.method}
            error={errors.method}
            onChange={onChange}
          />
        </div>

        {/* Always in the document, so the summary is announced when it appears. */}
        <div role="status" className="mt-14">
          {hasErrors && <ErrorMessage message={contact.errors.summary} className="mb-6" />}
        </div>

        <div className="flex flex-col gap-x-8 gap-y-5 sm:flex-row sm:items-center lg:max-xl:flex-col lg:max-xl:items-start">
          <Button
            type="submit"
            size="lg"
            className="max-sm:w-full"
            aria-disabled={submitting || undefined}
            aria-busy={submitting || undefined}
          >
            {/* Both labels share one cell, so the button keeps its width while sending. */}
            <span className="grid justify-items-center">
              <span className={cn("col-start-1 row-start-1", submitting && "invisible")}>
                {contact.submitLabel}
              </span>
              {submitting && (
                <span className="col-start-1 row-start-1">{contact.submittingLabel}</span>
              )}
            </span>
          </Button>
          <p className="type-small max-w-xs text-ink-muted">{contact.disclosure}</p>
        </div>
      </form>

      {sent && (
        <m.div
          className="col-start-1 row-start-1 border-t border-line-strong pt-8 max-lg:border-b max-lg:pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.base, ease: EASE.out }}
        >
          <h3 ref={thanks} tabIndex={-1} className="type-h2 outline-none">
            {contact.success.title}
          </h3>
          <p className="type-lead mt-6 text-ink-secondary">{contact.success.message}</p>
        </m.div>
      )}
    </div>
  );
}
