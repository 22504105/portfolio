import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { fill, type Messages } from "@/lib/i18n";
import { bucketLabel, timeSeries, type Bucket } from "@/lib/metrics/series";
import { formatMoney } from "@/lib/money";
import { formatDay } from "@/lib/time";
import type { PageData } from "@/lib/workspace";
import { EmptyState } from "./parts";

/** The buckets of the period, and of the period before it, for a page's filters and granularity. */
export function trendBuckets(page: PageData): { current: Bucket[]; previous: Bucket[] } {
  const { view, filtered, comparison, context } = page;
  const { timezone } = context.dataset.workspace;
  return {
    current: timeSeries(filtered, view.range, timezone, view.granularity),
    previous: timeSeries(filtered, comparison.previousRange, timezone, view.granularity),
  };
}

type TrendSectionProps = {
  page: PageData;
  messages: Messages;
  height?: number;
  /** Show the sentence that sums the chart up, instead of keeping it for screen readers only: for print. */
  describe?: boolean;
};

/**
 * The revenue chart with what a chart alone does not give: a legend that
 * tells the two lines apart by their style, and a sentence that says what
 * the picture shows for anyone who cannot see it.
 */
export function TrendSection({ page, messages, height, describe = false }: TrendSectionProps) {
  const { view, comparison, context } = page;
  const { currency } = context.dataset.workspace;
  const t = messages.chart;
  const { current, previous } = trendBuckets(page);

  if (comparison.current.completedOrders === 0) return <EmptyState title={t.empty} hint={t.emptyHint} />;

  const points: TrendPoint[] = current.map((bucket, index) => ({
    label: bucketLabel(bucket, view.granularity),
    current: bucket.netRevenueMinor,
    previous: previous[index]?.netRevenueMinor ?? null,
    previousLabel: previous[index] ? bucketLabel(previous[index], view.granularity) : null,
    orders: bucket.completedOrders,
  }));
  const peak = current.reduce((best, bucket) => (bucket.netRevenueMinor > best.netRevenueMinor ? bucket : best));
  const unit = { day: t.unitDay, week: t.unitWeek, month: t.unitMonth }[view.granularity];

  return (
    <figure className="min-w-0">
      <figcaption className={describe ? "mb-3 text-[0.8125rem]" : "sr-only"}>
        {fill(t.summary, {
          from: formatDay(view.range.from),
          to: formatDay(view.range.to),
          total: formatMoney(comparison.current.netRevenueMinor, currency),
          orders: comparison.current.completedOrders,
          unit,
          peakLabel: bucketLabel(peak, view.granularity),
          peak: formatMoney(peak.netRevenueMinor, currency),
        })}
      </figcaption>
      <ul aria-hidden="true" className="type-meta text-ink-muted mb-3 flex flex-wrap gap-x-5 gap-y-1">
        <li className="inline-flex items-center gap-2">
          <span className="bg-series-1 h-0.5 w-5 rounded-full" />
          {t.current}
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="border-series-4 h-0 w-5 border-t-2 border-dashed" />
          {t.previous}
        </li>
      </ul>
      <TrendChart
        points={points}
        currency={currency}
        labels={{ current: t.current, previous: t.previous, orders: t.orders }}
        height={height}
      />
    </figure>
  );
}
