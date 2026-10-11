import { Download } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/controls/FilterBar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { BarList, Card, EmptyState, formatShare, PageHeader, TableFrame, td, th } from "@/components/dashboard/parts";
import { TrendSection, trendBuckets } from "@/components/dashboard/TrendSection";
import { fill, type Messages } from "@/lib/i18n";
import { breakdown, DIMENSIONS, type Dimension } from "@/lib/metrics/breakdown";
import { bucketLabel, GRANULARITIES } from "@/lib/metrics/series";
import { formatMoney } from "@/lib/money";
import { formatRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import { hrefWith } from "@/lib/view/state";
import type { PageData } from "@/lib/workspace";

const whole = new Intl.NumberFormat("en-US");

/** A row of mutually exclusive choices, each a link. */
function Segmented<T extends string>({
  label,
  options,
  value,
  hrefFor,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  hrefFor: (option: T) => string;
}) {
  return (
    <ul aria-label={label} className="rounded-input border-input bg-surface inline-flex border p-0.5">
      {options.map(([option, name]) => (
        <li key={option}>
          <Link
            href={hrefFor(option)}
            scroll={false}
            aria-current={option === value ? "true" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-[8px] px-3 transition-colors",
              option === value ? "bg-brand-tint text-brand-hover font-medium" : "text-ink-muted hover:text-ink",
            )}
          >
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsPage({ page, messages }: { page: PageData; messages: Messages }) {
  const { context, pathname, params, view, inPeriod, comparison } = page;
  const { currency } = context.dataset.workspace;
  const t = messages.analytics;
  const { current } = comparison;

  const rows = breakdown(inPeriod, view.dimension);
  const buckets = trendBuckets(page).current;
  const exportHref = (kind: string) => hrefWith(`${context.root}/export/${kind}`, params, {});
  const filterParam: Record<Dimension, string> = { channel: "channel", category: "category", product: "product" };
  const download =
    "inline-flex h-10 items-center gap-2 rounded-input border border-input bg-surface px-3.5 font-medium transition-colors hover:bg-surface-2";

  return (
    <>
      <PageHeader title={t.title} subtitle={fill(t.subtitle, { range: formatRange(view.range) })} />

      <div className="mt-6">
        <FilterBar page={page} messages={messages} />
      </div>

      <div className="mt-6">
        <KpiCards comparison={comparison} currency={currency} messages={messages} />
      </div>

      <Card
        title={messages.overview.revenueTrend}
        titleId="trend-title"
        className="mt-5 lg:mt-6"
        action={
          <Segmented
            label={messages.chart.granularity}
            value={view.granularity}
            options={GRANULARITIES.map((item) => [item, messages.chart[item]] as const)}
            hrefFor={(option) => hrefWith(pathname, params, { g: option })}
          />
        }
      >
        <TrendSection page={page} messages={messages} height={340} />
      </Card>

      <Card
        title={t.breakdown}
        titleId="breakdown-title"
        className="mt-5 lg:mt-6"
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented
              label={t.by}
              value={view.dimension}
              options={DIMENSIONS.map((item) => [item, t[item]] as const)}
              hrefFor={(option) => hrefWith(pathname, params, { by: option === "channel" ? null : option })}
            />
            <a href={exportHref("breakdown")} className={download}>
              <Download aria-hidden="true" className="size-4" />
              {t.downloadBreakdown}
            </a>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title={messages.chart.empty} hint={messages.chart.emptyHint} />
        ) : (
          <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <BarList
              rows={rows.slice(0, 8)}
              currency={currency}
              series={view.dimension === "channel" ? 2 : view.dimension === "category" ? 4 : 3}
              hrefFor={(key) => hrefWith(pathname, params, { [filterParam[view.dimension]]: key })}
              linkLabel={(key) => fill(t.filterBy, { value: key })}
            />
            <div className="min-w-0">
              <div
                role="region"
                aria-labelledby="breakdown-title"
                tabIndex={0}
                className="border-line overflow-x-auto rounded-[10px] border"
              >
                <table className="w-full border-collapse text-left">
                  <thead className="border-line bg-surface-2 border-b">
                    <tr>
                      <th scope="col" className={th}>
                        {t[view.dimension]}
                      </th>
                      <th scope="col" className={cn(th, "text-right")}>
                        {t.revenue}
                      </th>
                      <th scope="col" className={cn(th, "text-right")}>
                        {t.share}
                      </th>
                      <th scope="col" className={cn(th, "text-right")}>
                        {t.orders}
                      </th>
                      <th scope="col" className={cn(th, "text-right")}>
                        {t.units}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y tabular-nums">
                    {rows.map((row) => (
                      <tr key={row.key}>
                        <th scope="row" className={cn(td, "max-w-64 truncate font-medium")}>
                          {row.key}
                        </th>
                        <td className={cn(td, "text-right")}>{formatMoney(row.netRevenueMinor, currency)}</td>
                        <td className={cn(td, "text-ink-muted text-right")}>{formatShare(row.share)}</td>
                        <td className={cn(td, "text-right")}>{whole.format(row.orders)}</td>
                        <td className={cn(td, "text-right")}>{whole.format(row.units)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-line bg-surface-2 border-t font-medium tabular-nums">
                    <tr>
                      <th scope="row" className={td}>
                        {t.total}
                      </th>
                      <td className={cn(td, "text-right")}>{formatMoney(current.netRevenueMinor, currency)}</td>
                      <td className={cn(td, "text-right")}>{formatShare(current.netRevenueMinor === 0 ? null : 1)}</td>
                      <td className={cn(td, "text-right")}>{whole.format(current.completedOrders)}</td>
                      <td className={cn(td, "text-right")}>{whole.format(rows.reduce((sum, row) => sum + row.units, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {view.dimension !== "channel" && <p className="type-meta text-ink-muted mt-3">{t.ordersNote}</p>}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-5 lg:mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="series-title" className="type-card">
            {t.overTime}
          </h2>
          <a href={exportHref("series")} className={download}>
            <Download aria-hidden="true" className="size-4" />
            {t.downloadSeries}
          </a>
        </div>
        <TableFrame label={t.overTime}>
          <thead className="border-line bg-surface-2 border-b">
            <tr>
              <th scope="col" className={th}>
                {t.period}
              </th>
              <th scope="col" className={cn(th, "text-right")}>
                {t.revenue}
              </th>
              <th scope="col" className={cn(th, "text-right")}>
                {t.orders}
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y tabular-nums">
            {buckets.map((bucket) => (
              <tr key={bucket.from}>
                <th scope="row" className={cn(td, "font-normal whitespace-nowrap")}>
                  {bucketLabel(bucket, view.granularity)}
                </th>
                <td className={cn(td, "text-right")}>{formatMoney(bucket.netRevenueMinor, currency)}</td>
                <td className={cn(td, "text-right")}>{whole.format(bucket.completedOrders)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-line bg-surface-2 border-t font-medium tabular-nums">
            <tr>
              <th scope="row" className={td}>
                {t.total}
              </th>
              <td className={cn(td, "text-right")}>{formatMoney(current.netRevenueMinor, currency)}</td>
              <td className={cn(td, "text-right")}>{whole.format(current.completedOrders)}</td>
            </tr>
          </tfoot>
        </TableFrame>
      </div>
    </>
  );
}
