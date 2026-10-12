"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// The few controls every screen is made of. Each is at least 44px tall, so a
// thumb finds it; each says what it is to a screen reader without help.

const VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border-field bg-surface text-ink hover:bg-surface-2 border",
  ghost: "text-ink hover:bg-surface-2",
  danger: "border-danger/50 text-danger hover:bg-danger/10 border",
  dangerFill: "bg-danger-fill text-white hover:opacity-90",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS; busy?: boolean; small?: boolean };

export const buttonClass = (variant: keyof typeof VARIANTS = "primary", small = false) =>
  cn(
    "rounded-control inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    small ? "type-small h-11 px-3.5" : "h-12 px-5",
    VARIANTS[variant],
  );

export function Button({
  variant = "primary",
  busy = false,
  small = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(buttonClass(variant, small), className)}
      {...props}
    >
      {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export const inputClass =
  "rounded-control border-field bg-surface text-ink placeholder:text-ink-muted/70 h-12 w-full min-w-0 border px-3.5 text-base aria-[invalid=true]:border-danger disabled:opacity-60";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  /** Gets what ties the control to its label, hint and error. */
  children: (control: { id: string; "aria-describedby": string | undefined; "aria-invalid": true | undefined }) => ReactNode;
};

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="type-small font-semibold">
        {label}
      </label>
      {children({ id, "aria-describedby": described, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="type-small text-ink-muted">
          {hint}
        </p>
      )}
      {error && <Problem id={`${id}-error`}>{error}</Problem>}
    </div>
  );
}

/** Something is wrong: said in words, with a mark, never by colour alone. */
export function Problem({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} role="alert" className={cn("type-small text-danger flex items-start gap-1.5 font-medium", className)}>
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="type-small text-ink-muted flex items-center gap-2 py-6">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {label}
    </p>
  );
}

type ConfirmProps = {
  /** What the button says before it is pressed. */
  label: string;
  /** The question asked once it is. */
  question: string;
  yes: string;
  no: string;
  variant?: keyof typeof VARIANTS;
  small?: boolean;
  onConfirm: () => Promise<void> | void;
};

/** A button for things that cannot be taken back: it asks once, in place, before doing it. */
export function Confirm({ label, question, yes, no, variant = "danger", small = true, onConfirm }: ConfirmProps) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return (
      <Button variant={variant} small={small} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div role="group" aria-label={label} className="border-danger/40 bg-danger/5 rounded-control flex flex-col gap-3 border p-3.5">
      <p className="type-small font-medium">{question}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="dangerFill"
          small
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              setAsking(false);
            }
          }}
        >
          {yes}
        </Button>
        <Button variant="secondary" small autoFocus onClick={() => setAsking(false)}>
          {no}
        </Button>
      </div>
    </div>
  );
}
