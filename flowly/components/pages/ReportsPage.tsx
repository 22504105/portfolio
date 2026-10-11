import { Download } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { FilterBar } from "@/components/controls/FilterBar";
import { formatShare, PageHeader } from "@/components/dashboard/parts";
import { TrendSection } from "@/components/dashboard/TrendSection";
import { PrintButton } from "@/components/reports/PrintButton";
import { ORDER_STATUSES } from "@/lib/domain/types";
import { fill, type Messages } from "@/lib/i18n";
import { breakdown, type BreakdownRow } from "@/lib/metrics/breakdown";
import { hasFilters } from "@/lib/metrics/filters";
import { reportRows } from "@/lib/metrics/report";
import { formatMoney } from "@/lib/money";
import { daysIn, formatRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import { hrefWith } from "@/lib/view/state";
import type { PageData } from "@/lib/workspace";

const whole = new Intl.NumberFormat("en-US");
const TOP = 10;

const th = "border-b border-ink/70 py-2 text-left font-semibold";
const td = "border-b border-line py-2 align-top";

/** One breakdown as a plain ruled table: the form that prints best. */
function BreakdownTable({
  title,
  column,
  rows,
  currency,
  labels,
  analytics,
}: {
  title: string;
  column: string;
  rows: BreakdownRow[];
  currency: string;
  labels: Messages["reports"];
  analytics: Messages["analytics"];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="break-inside-avoid">
      <h3 className="text-[1rem] font-semibold tracking-[-0.01em]">{title}</h3>
      <table className="mt-2 w-full border-collapse text-[0.8125rem] tabular-nums">
        <thead>
          <tr>
            <th scope="col" className={th}>
              {column}
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              {analytics.revenue}
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              {analytics.share}
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              {analytics.units}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, TOP).map((row) => (
            <tr key={row.key}>
              <th scope="row" className={cn(td, "pr-3 text-left font-normal")}>
                {row.key}
              </th>
              <td className={cn(td, "text-right")}>{formatMoney(row.netRevenueMinor, currency)}</td>
              <td className={cn(td, "text-right")}>{formatShare(row.share)}</td>
              <td className={cn(td, "text-right")}>{whole.format(row.units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > TOP && <p className="text-ink-muted mt-1.5 text-[0.75rem]">{fill(labels.topNote, { count: rows.length })}</p>}
    </section>
  );
}

export function ReportsPage({ page, messages }: { page: PageData; messages: Messages }) {
  const { context, params, view, inPeriod, comparison } = page;
  const { dataset, root } = context;
  const { currency, timezone, name } = dataset.workspace;
  const t = messages.reports;
  const { filters } = view;
  const rows = reportRows(comparison, currency, messages);
  const empty = comparison.current.completedOrders === 0;

  const applied = [
    filters.statuses.length > 0 && `${messages.filters.status}: ${filters.statuses.map((status) => messages.status[status]).join(", ")}`,
    filters.channel && `${messages.filters.channel}: ${filters.channel}`,
    filters.category && `${messages.filters.category}: ${filters.category}`,
    filters.product && `${messages.filters.product}: ${filters.product}`,
  ].filter(Boolean) as string[];

  const download =
    "inline-flex h-10 items-center gap-2 rounded-input border border-input bg-surface px-3.5 font-medium transition-colors hover:bg-surface-2";

  return (
    <>
      {/* Everything in this block is for the screen; none of it is printed. */}
      <div className="print:hidden">
        <PageHeader title={t.title} subtitle={t.subtitle}>
          <a href={hrefWith(`${root}/export/report`, params, {})} className={download}>
            <Download aria-hidden="true" className="size-4" />
            {t.downloadSummary}
          </a>
          <a href={hrefWith(`${root}/export/transactions`, params, {})} className={download}>
            <Download aria-hidden="true" className="size-4" />
            {t.downloadTransactions}
          </a>
          <PrintButton label={t.print} hint={t.printHint} />
        </PageHeader>
        <div className="mt-6">
          <FilterBar page={page} messages={messages} />
        </div>
      </div>

      {/* The sheet: A4 wide on screen, so what is seen is what is printed. */}
      <article
        aria-labelledby="report-title"
        className="report-sheet rounded-card border-line bg-surface shadow-card mx-auto mt-7 w-full max-w-[794px] border px-6 py-8 sm:px-12 sm:py-12 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <header className="border-ink flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-b-2 pb-5">
          <div className="min-w-0">
            <p className="type-label text-ink-muted">{name}</p>
            <h2 id="report-title" className="mt-1.5 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">
              {t.reportTitle}
            </h2>
            <p className="mt-1 text-[1.0625rem] tabular-nums">{formatRange(view.range)}</p>
          </div>
          <Logo className="text-ink" />
        </header>

        <dl className="mt-5 grid gap-x-8 gap-y-2 text-[0.8125rem] sm:grid-cols-2">
          <div>
            <dt className="inline font-semibold">{t.compared}: </dt>
            <dd className="inline tabular-nums">
              {formatRange(comparison.previousRange)} ({daysIn(view.range)} d)
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">{t.filters}: </dt>
            <dd className="inline">{hasFilters(filters) ? applied.join(" · ") : t.noFilters}</dd>
          </div>
          <div className="sm:col-span-2">
            <dd className="text-ink-muted">{fill(t.generated, { timezone, currency })}</dd>
          </div>
        </dl>

        {dataset.provenance.kind === "demo" && (
          <p className="border-brand/30 bg-brand-tint text-brand-hover print:border-ink/40 print:text-ink mt-4 rounded-[8px] border px-3 py-2 text-[0.8125rem] font-medium print:bg-transparent">
            {t.demoNotice}
          </p>
        )}

        <section className="mt-8 break-inside-avoid">
          <h3 className="text-[1rem] font-semibold tracking-[-0.01em]">{t.summary}</h3>
          <table className="mt-2 w-full border-collapse text-[0.875rem] tabular-nums">
            <thead>
              <tr>
                <th scope="col" className={th}>
                  {t.metric}
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  {t.thisPeriod}
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  {t.previousPeriod}
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  {t.change}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className={cn(td, "text-left font-normal")}>
                    {row.label}
                  </th>
                  <td className={cn(td, "text-right font-semibold")}>{row.current}</td>
                  <td className={cn(td, "text-right")}>{row.previous}</td>
                  <td className={cn(td, "text-right")}>{row.change ?? t.noChange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {empty ? (
          <p className="border-line bg-surface-2 mt-8 rounded-[8px] border px-4 py-3">{t.empty}</p>
        ) : (
          <>
            <section className="mt-8 break-inside-avoid">
              <h3 className="mb-3 text-[1rem] font-semibold tracking-[-0.01em]">{t.trend}</h3>
              <TrendSection page={page} messages={messages} height={250} describe />
            </section>

            <div className="mt-8 flex flex-col gap-8">
              <BreakdownTable
                title={t.byChannel}
                column={messages.analytics.channel}
                rows={breakdown(inPeriod, "channel")}
                currency={currency}
                labels={t}
                analytics={messages.analytics}
              />
              <BreakdownTable
                title={t.byCategory}
                column={messages.analytics.category}
                rows={breakdown(inPeriod, "category")}
                currency={currency}
                labels={t}
                analytics={messages.analytics}
              />
              <BreakdownTable
                title={t.byProduct}
                column={messages.analytics.product}
                rows={breakdown(inPeriod, "product")}
                currency={currency}
                labels={t}
                analytics={messages.analytics}
              />
            </div>
          </>
        )}

        <section className="mt-8 break-inside-avoid">
          <h3 className="text-[1rem] font-semibold tracking-[-0.01em]">{t.statuses}</h3>
          <table className="mt-2 w-full max-w-xs border-collapse text-[0.8125rem] tabular-nums">
            <tbody>
              {ORDER_STATUSES.map((status) => (
                <tr key={status}>
                  <th scope="row" className={cn(td, "text-left font-normal")}>
                    {messages.status[status]}
                  </th>
                  <td className={cn(td, "text-right")}>{whole.format(comparison.current.byStatus[status])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="border-line mt-10 break-inside-avoid border-t pt-5">
          <h3 className="text-[0.8125rem] font-semibold">{t.method}</h3>
          <ol className="text-ink-muted print:text-ink mt-2 list-decimal space-y-1 pl-4 text-[0.75rem] leading-relaxed">
            {t.methods.map((method) => (
              <li key={method}>{method}</li>
            ))}
          </ol>
          <p className="text-ink-muted mt-4 text-[0.75rem]">{t.footer}</p>
        </footer>
      </article>
    </>
  );
}
