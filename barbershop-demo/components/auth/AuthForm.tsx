"use client";

import { useActionState, type ComponentProps, type ReactNode } from "react";
import type { AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

export type AuthField = {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "tel";
  autoComplete: ComponentProps<"input">["autoComplete"];
  defaultValue?: string;
  hint?: string;
  required?: boolean;
};

type AuthFormProps = {
  action: (state: AuthState, form: FormData) => Promise<AuthState>;
  fields: AuthField[];
  /** Sent along with the fields: the page language, where to go afterwards. */
  hidden?: Record<string, string>;
  submit: string;
  working: string;
  /** What to say for each error code the action can answer with. */
  errors: Partial<Record<NonNullable<AuthState["error"]>, string>>;
  /** Shown in place of the form once the action has succeeded. */
  done?: ReactNode;
  /** Shown above the button once the action has succeeded, with the form kept. */
  saved?: string;
  children?: ReactNode;
};

export const FIELD =
  "type-lead mt-1 block h-14 w-full border-b border-line bg-transparent text-fg transition-colors duration-(--duration-fast) " +
  "hover:border-fg focus-visible:border-signal focus-visible:outline-none";

/** A small form bound to a server action: sign in, sign up, reset, profile. Works without JavaScript. */
export function AuthForm({ action, fields, hidden = {}, submit, working, errors, done, saved, children }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.done && done) return <div role="status">{done}</div>;

  return (
    <form action={formAction} className="max-w-md">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="space-y-8">
        {fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={`field-${field.name}`} className="type-eyebrow block text-muted">
              {field.label}
            </label>
            <input
              id={`field-${field.name}`}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              defaultValue={field.defaultValue}
              required={field.required ?? true}
              aria-describedby={field.hint ? `field-${field.name}-hint` : undefined}
              className={FIELD}
            />
            {field.hint && (
              <p id={`field-${field.name}-hint`} className="type-small mt-2 text-muted">
                {field.hint}
              </p>
            )}
          </div>
        ))}
        {children}
      </div>

      {/* Always in the document, so the answer is announced when it arrives. */}
      <div role="alert" className="mt-8">
        {state.error && (
          <p className="type-body flex items-baseline gap-3 font-medium">
            <span aria-hidden="true" className="size-2 shrink-0 bg-signal" />
            {errors[state.error] ?? errors.failed}
          </p>
        )}
      </div>
      <div role="status">{state.done && saved && <p className="type-body font-medium">{saved}</p>}</div>

      <Button type="submit" variant="signal" size="lg" className="mt-6" aria-disabled={pending || undefined} aria-busy={pending || undefined}>
        {pending ? working : submit}
      </Button>
    </form>
  );
}
