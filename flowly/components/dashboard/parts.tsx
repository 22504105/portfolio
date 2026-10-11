import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { OrderStatus } from "@/lib/domain/types";
import { fill, type Messages } from "@/lib/i18n";
import type { BreakdownRow } from "@/lib/metrics/breakdown";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { hrefWith, type SearchParams, type View } from "@/lib/view/state";

// Small pieces the workspace pages share: page header, card, bars, status
// chip, table header, pagination, search, empty state.

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="type-page">{title}</h1>
        {subtitle && <p className="text-ink-muted mt-1.5 text-[0.9375rem]">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

type CardProps = { title: string; titleId?: string; action?: ReactNode; className?: string; children: ReactNode };

export function Card({ title, titleId, action, className, children }: CardProps) {
  return (
    <section aria-labelledby={titleId} className={cn("card flex min-w-0 flex-col p-5 lg:p-6", className)}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={titleId} className="type-card">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const textLink = "inline-flex min-h-8 items-center font-medium text-brand-hover underline-offset-4 hover:underline";

const percent = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatShare = (share: number | null) => (share === null ? "–" : percent.format(share));

type BarListProps = {
  rows: BreakdownRow[];
  currency: string;
  /** Where clicking a row leads: usually the same page filtered to that row. */
  hrefFor?: (key: string) => string;
  linkLabel?: (key: string) => string;
  /** Which chart colour the bars take. */
  series?: 1 | 2 | 3 | 4 | 5;
};

/** A ranked list with bars: easier to read than a pie, and every value is written out. */
export function BarList({ rows, currency, hrefFor, linkLabel, series = 1 }: BarListProps) {
  const largest = Math.max(1, ...rows.map((row) => row.netRevenueMinor));
  return (
    <ol className="flex flex-col gap-3.5">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-4">
            {hrefFor ? (
              <Link
                href={hrefFor(row.key)}
                scroll={false}
                aria-label={linkLabel?.(row.key)}
                className="-my-1.5 block min-w-0 truncate py-1.5 font-medium underline-offset-4 hover:underline"
              >
                {row.key}
              </Link>
            ) : (
              <span className="min-w-0 truncate font-medium">{row.key}</span>
            )}
            <span className="shrink-0 tabular-nums">
              {formatMoney(row.netRevenueMinor, currency)}
              <span className="type-meta text-ink-muted ml-2 inline-block w-11 text-right">{formatShare(row.share)}</span>
            </span>
          </div>
          <div aria-hidden="true" className="bg-surface-2 mt-1.5 h-1.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(0, (row.netRevenueMinor / largest) * 100)}%`, background: `var(--series-${series})` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  completed: "border-positive/30 bg-positive/8 text-positive",
  refunded: "border-warning/35 bg-warning/8 text-warning",
  cancelled: "border-negative/30 bg-negative/8 text-negative",
  pending: "border-input bg-surface-2 text-ink-muted",
};
const STATUS_DOT: Record<OrderStatus, string> = {
  completed: "bg-positive",
  refunded: "bg-warning",
  cancelled: "bg-negative",
  pending: "border border-ink-muted",
};

/** A status as a word in a pill, with a dot whose shape and colour differ by status. */
export function StatusChip({ status, labels }: { status: OrderStatus; labels: Messages["status"] }) {
  return (
    <span
      className={cn(
        "type-meta inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 font-medium whitespace-nowrap",
        STATUS_STYLE[status],
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {labels[status]}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" }) {
  return (
    <span
      className={cn(
        "type-meta inline-flex h-6 items-center rounded-full border px-2.5 font-medium whitespace-nowrap",
        tone === "brand" ? "border-brand/30 bg-brand-tint text-brand-hover" : "border-input bg-surface-2 text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}

type SortHeaderProps = {
  column: string;
  label: string;
  pathname: string;
  params: SearchParams;
  view: View;
  labels: Messages["table"];
  align?: "left" | "right";
};

/** A column heading that sorts by its column; pressing it again reverses the order. */
export function SortHeader({ column, label, pathname, params, view, labels, align = "left" }: SortHeaderProps) {
  const active = view.sort === column;
  const nextDescending = active ? !view.descending : true;
  const Icon = active ? (view.descending ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (view.descending ? "descending" : "ascending") : undefined}
      className={cn("px-4 py-0 font-medium", align === "right" && "text-right")}
    >
      <Link
        href={hrefWith(pathname, params, { sort: column, dir: nextDescending ? null : "asc" })}
        scroll={false}
        title={fill(labels.sortBy, { column: label })}
        className={cn(
          "hover:text-ink inline-flex h-11 items-center gap-1.5 whitespace-nowrap",
          active ? "text-ink" : "text-ink-muted",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon aria-hidden="true" className={cn("size-3.5", !active && "opacity-60")} />
      </Link>
    </th>
  );
}

export const th = "h-11 whitespace-nowrap px-4 font-medium text-ink-muted";
export const td = "px-4 py-3 align-middle";

/** A table in a card. Wider than its place, it scrolls sideways inside the card, never the page. */
export function TableFrame({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn("card min-w-0 overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

type PaginationProps = { pathname: string; params: SearchParams; page: number; pageSize: number; total: number; labels: Messages["table"] };

export function Pagination({ pathname, params, page, pageSize, total, labels }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const button = "inline-flex h-10 items-center gap-1 rounded-input border border-input bg-surface px-3 font-medium transition-colors";
  const link = (target: number, label: string, icon: ReactNode, iconFirst: boolean) =>
    target >= 1 && target <= pages ? (
      <Link href={hrefWith(pathname, params, { page: target === 1 ? null : target })} className={cn(button, "hover:bg-surface-2")}>
        {iconFirst && icon}
        {label}
        {!iconFirst && icon}
      </Link>
    ) : (
      <span aria-disabled="true" className={cn(button, "text-ink-muted opacity-60")}>
        {iconFirst && icon}
        {label}
        {!iconFirst && icon}
      </span>
    );

  return (
    <nav aria-label={labels.pagination} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-ink-muted tabular-nums">
        {fill(labels.showing, { from: (page - 1) * pageSize + 1, to: Math.min(total, page * pageSize), total })}
        <span className="max-sm:hidden"> · {fill(labels.pageOf, { page, pages })}</span>
      </p>
      <div className="flex gap-2">
        {link(page - 1, labels.previous, <ChevronLeft aria-hidden="true" className="size-4" />, true)}
        {link(page + 1, labels.next, <ChevronRight aria-hidden="true" className="size-4" />, false)}
      </div>
    </nav>
  );
}

type SearchFormProps = {
  pathname: string;
  params: SearchParams;
  query: string;
  label: string;
  placeholder: string;
  labels: Messages["table"];
};

/** A search box that works as a plain form: it submits to the page's own address. */
export function SearchForm({ pathname, params, query, label, placeholder, labels }: SearchFormProps) {
  // Everything else in the address is kept, except the page number and any open drawer.
  const kept = Object.entries(params).filter(
    ([key, value]) => typeof value === "string" && value && !["q", "page", "order", "customer"].includes(key),
  );
  return (
    <form action={pathname} role="search" className="flex w-full max-w-md items-center gap-2">
      {kept.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value as string} />
      ))}
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          aria-label={label}
          placeholder={placeholder}
          maxLength={120}
          className="rounded-input border-input bg-surface text-ink placeholder:text-ink-muted h-10 w-full border pr-3 pl-9"
        />
      </div>
      <button
        type="submit"
        className="rounded-input border-input bg-surface hover:bg-surface-2 inline-flex h-10 items-center border px-3.5 font-medium transition-colors"
      >
        {labels.search}
      </button>
      {query && (
        <Link
          href={hrefWith(pathname, params, { q: null })}
          aria-label={labels.clearSearch}
          className="rounded-input text-ink-muted hover:bg-surface-2 hover:text-ink inline-flex size-10 shrink-0 items-center justify-center transition-colors"
        >
          <X aria-hidden="true" className="size-4" />
        </Link>
      )}
    </form>
  );
}

type SortChipsProps = {
  columns: readonly (readonly [string, string])[];
  pathname: string;
  params: SearchParams;
  view: View;
  labels: Messages["table"];
  /** The width from which the table, with its own sortable headings, takes over. */
  until?: "md" | "lg";
};

/** Sorting for the phone layout, where a table's column headings are not shown. */
export function SortChips({ columns, pathname, params, view, labels, until = "md" }: SortChipsProps) {
  return (
    <ul aria-label={labels.sort} className={cn("flex gap-1.5 overflow-x-auto pb-1", until === "md" ? "md:hidden" : "lg:hidden")}>
      {columns.map(([column, label]) => {
        const active = view.sort === column;
        const Icon = view.descending ? ArrowDown : ArrowUp;
        return (
          <li key={column} className="shrink-0">
            <Link
              href={hrefWith(pathname, params, { sort: column, dir: active && view.descending ? "asc" : null })}
              scroll={false}
              aria-current={active ? "true" : undefined}
              title={fill(labels.sortBy, { column: label })}
              className={cn(
                "inline-flex h-10 items-center gap-1 rounded-full border px-3.5 whitespace-nowrap transition-colors",
                active ? "border-brand/50 bg-brand-tint text-brand-hover font-medium" : "border-input bg-surface text-ink-muted",
              )}
            >
              {label}
              {active && <Icon aria-hidden="true" className="size-3.5" />}
              {active && <span className="sr-only">{view.descending ? labels.descending : labels.ascending}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="type-card">{title}</p>
      <p className="text-ink-muted mt-1.5 max-w-sm">{hint}</p>
    </div>
  );
}

/** A small labelled figure, for the second row of the overview. */
export function Stat({ label, value, note, muted = false }: { label: string; value: string; note: string; muted?: boolean }) {
  return (
    <div className="card p-5">
      <dt className="text-ink-muted font-medium">{label}</dt>
      <dd className="mt-2">
        <span className={cn("text-[1.375rem] font-semibold tracking-[-0.02em] tabular-nums", muted && "text-ink-muted")}>{value}</span>
        <span className="type-meta text-ink-muted mt-1 block">{note}</span>
      </dd>
    </div>
  );
}
