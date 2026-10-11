import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { FIELD } from "@/components/auth/AuthForm";
import { Link } from "@/i18n/navigation";
import type { AdminSource } from "@/lib/admin/types";

// Small pieces shared by the admin pages.

/** What an admin page is given: where its data comes from and where its links lead. */
export type AdminContext = {
  source: AdminSource;
  /** "/admin" or "/demo/admin": the same pages serve both. */
  base: "/admin" | "/demo/admin";
  locale: "en" | "ru";
  /** The query of the request, already reduced to single values. */
  query: Record<string, string | undefined>;
};

export const SECTIONS = ["overview", "calendar", "bookings", "services", "barbers", "clients", "analytics", "settings"] as const;
export type Section = (typeof SECTIONS)[number];

export const sectionPath = (section: Section) => (section === "overview" ? "" : `/${section}`);

/** The result of the last action, read from the address: ?notice=saved or ?notice=error:code. */
export function Notice({ value }: { value: string | undefined }) {
  const t = useTranslations("admin.notice");
  if (!value) return null;
  const error = value.startsWith("error:") ? value.slice(6) : null;
  const known = ["invalid", "slot_taken", "not_eligible", "off_grid", "outside_horizon", "in_the_past", "too_early", "not_changeable", "not_completed", "has_bookings", "already_decided", "duplicate", "failed"] as const;
  const done = ["saved", "created", "cancelled", "moved", "outcome", "paid", "unpaid", "decided"] as const;
  const message = error
    ? t(`error.${(known as readonly string[]).includes(error) ? (error as (typeof known)[number]) : "failed"}`)
    : (done as readonly string[]).includes(value)
      ? t(value as (typeof done)[number])
      : null;
  if (!message) return null;

  return (
    <p role={error ? "alert" : "status"} className={`type-body mb-8 flex items-baseline gap-3 border p-4 font-medium ${error ? "border-signal" : "border-line"}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 ${error ? "bg-signal" : "bg-fg"}`} />
      {message}
    </p>
  );
}

type FieldProps = Omit<ComponentProps<"input">, "className"> & { label: string; name: string; className?: string };

/** A labelled input for the admin's forms. */
export function Field({ label, name, className = "", id = `f-${name}`, ...rest }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="type-eyebrow block text-muted">
        {label}
      </label>
      <input id={id} name={name} className={`${FIELD} scheme-dark`} {...rest} />
    </div>
  );
}

/** A figure with its label, for the top of a page. */
export function Figure({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="type-eyebrow text-muted">{label}</p>
      <p className="type-h1 mt-3 tabular-nums">{value}</p>
      {note && <p className="type-small mt-2 text-muted">{note}</p>}
    </div>
  );
}

export const TH = "type-eyebrow border-b border-line py-3 pr-4 text-left font-medium text-muted";
export const TD = "border-b border-line py-3 pr-4 align-top";

/** A wide table that scrolls sideways inside its own box on a narrow screen. */
export function Table({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="-mx-gutter overflow-x-auto px-gutter">
      <table className="type-body w-full min-w-[40rem] border-collapse border-t border-line">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

/** A link styled as a tab of the date strip or of the range presets. */
export function Chip({ current, children, ...link }: ComponentProps<typeof Link> & { current: boolean }) {
  return (
    <Link
      aria-current={current ? "true" : undefined}
      className="type-label inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border border-line px-4 transition-colors duration-(--duration-fast) hover:border-fg aria-[current]:border-signal aria-[current]:bg-signal aria-[current]:text-ink"
      {...link}
    >
      {children}
    </Link>
  );
}
