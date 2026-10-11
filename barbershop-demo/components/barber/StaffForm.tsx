"use client";

import { useActionState } from "react";
import type { StaffState } from "@/app/actions/account";
import { FIELD } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/Button";

export type StaffField = {
  name: string;
  label: string;
  type: "time" | "date" | "text";
  defaultValue?: string;
  min?: string;
  required?: boolean;
};

type StaffFormProps = {
  action: (state: StaffState, form: FormData) => Promise<StaffState>;
  fields: StaffField[];
  hidden?: Record<string, string>;
  submit: string;
  /** Messages by the code the action answers with; `failed` covers the rest. */
  errors: Record<string, string>;
  /** Messages by the kind of success. */
  done: Record<string, string>;
};

/** A short form on the barber's calendar: a break, or a request for time off. */
export function StaffForm({ action, fields, hidden = {}, submit, errors, done }: StaffFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid gap-6 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className={field.type === "text" ? "sm:col-span-2" : undefined}>
            <label htmlFor={`staff-${field.name}`} className="type-eyebrow block text-muted">
              {field.label}
            </label>
            <input
              id={`staff-${field.name}`}
              name={field.name}
              type={field.type}
              defaultValue={field.defaultValue}
              min={field.min}
              step={field.type === "time" ? 300 : undefined}
              required={field.required ?? true}
              className={`${FIELD} scheme-dark`}
            />
          </div>
        ))}
      </div>

      {/* Always in the document, so the answer is announced when it arrives. */}
      <div role="alert" className="mt-6">
        {state.error && (
          <p className="type-body flex items-baseline gap-3 font-medium">
            <span aria-hidden="true" className="size-2 shrink-0 bg-signal" />
            {errors[state.error] ?? errors.failed}
          </p>
        )}
      </div>
      <div role="status">{state.done && <p className="type-body font-medium">{done[state.done]}</p>}</div>

      <Button type="submit" variant="outline" className="mt-4" aria-disabled={pending || undefined}>
        {submit}
      </Button>
    </form>
  );
}
