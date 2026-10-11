import { Check, X } from "lucide-react";
import Link from "next/link";
import { ORDER_STATUSES } from "@/lib/domain/types";
import type { Messages } from "@/lib/i18n";
import { hasFilters } from "@/lib/metrics/filters";
import { cn } from "@/lib/utils";
import { hrefWith } from "@/lib/view/state";
import type { PageData } from "@/lib/workspace";
import { FilterSelect } from "./FilterSelect";

type FilterBarProps = {
  page: PageData;
  messages: Messages;
  /** Pages that only ever count completed orders have no use for a status filter. */
  showStatus?: boolean;
};

/** The filters shared by every page. Each one is a link or a menu that changes the address. */
export function FilterBar({ page, messages, showStatus = true }: FilterBarProps) {
  const { pathname, params, view, options } = page;
  const { filters } = view;
  const t = messages.filters;
  const byLine = filters.category !== null || filters.product !== null;

  const statusHref = (status: (typeof ORDER_STATUSES)[number]) => {
    const next = filters.statuses.includes(status) ? filters.statuses.filter((item) => item !== status) : [...filters.statuses, status];
    return hrefWith(pathname, params, { status: next.join(",") });
  };

  return (
    <section aria-label={t.label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {showStatus && (
          <ul aria-label={t.status} className="flex flex-wrap gap-1.5">
            {ORDER_STATUSES.map((status) => {
              const active = filters.statuses.includes(status);
              return (
                <li key={status}>
                  <Link
                    href={statusHref(status)}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 transition-colors",
                      active
                        ? "border-brand/50 bg-brand-tint text-brand-hover font-medium"
                        : "border-input bg-surface text-ink hover:bg-surface-2",
                    )}
                  >
                    {active && <Check aria-hidden="true" className="size-3.5" />}
                    {messages.status[status]}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <FilterSelect
          name="channel"
          label={t.channel}
          value={filters.channel}
          options={options.channels}
          allLabel={t.all}
          pathname={pathname}
          params={params}
        />
        <FilterSelect
          name="category"
          label={t.category}
          value={filters.category}
          options={options.categories}
          allLabel={t.all}
          pathname={pathname}
          params={params}
        />
        <FilterSelect
          name="product"
          label={t.product}
          value={filters.product}
          options={options.products}
          allLabel={t.all}
          pathname={pathname}
          params={params}
        />

        {hasFilters(filters) && (
          <Link
            href={hrefWith(pathname, params, { status: null, channel: null, category: null, product: null })}
            scroll={false}
            className="rounded-input text-ink-muted hover:text-ink inline-flex h-10 items-center gap-1.5 px-2.5 font-medium underline-offset-4 transition-colors hover:underline"
          >
            <X aria-hidden="true" className="size-4" />
            {t.clear}
          </Link>
        )}
      </div>
      {byLine && <p className="type-meta text-ink-muted">{t.lineNote}</p>}
    </section>
  );
}
