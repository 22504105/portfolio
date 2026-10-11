import type { Messages } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { delta, type Comparison } from "./summary";

// The summary table of a report: the same figures as the dashboard, written
// out for both periods with the change between them. The printed report and
// its CSV download are both made from these rows.

export type ReportRow = {
  label: string;
  current: string;
  previous: string;
  /** "+4.2%" or an absolute change where a percentage would mislead; null when there is nothing to compare. */
  change: string | null;
  /** The raw values, for the CSV. */
  raw: { current: number | null; previous: number | null };
};

const whole = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const points = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });

export function reportRows(comparison: Comparison, currency: string, messages: Messages): ReportRow[] {
  const { current, previous } = comparison;
  const { kpi, overview } = messages;
  const money = (minor: number | null) => (minor === null ? kpi.unavailable : formatMoney(minor, currency));
  const change = (now: number | null, before: number | null) => {
    const moved = delta(now, before);
    return moved && moved.ratio !== null ? signed.format(moved.ratio) : null;
  };

  return [
    {
      label: kpi.netRevenue,
      current: money(current.netRevenueMinor),
      previous: money(previous.netRevenueMinor),
      change: change(current.netRevenueMinor, previous.netRevenueMinor),
      raw: { current: current.netRevenueMinor, previous: previous.netRevenueMinor },
    },
    {
      label: kpi.completedOrders,
      current: whole.format(current.completedOrders),
      previous: whole.format(previous.completedOrders),
      change: change(current.completedOrders, previous.completedOrders),
      raw: { current: current.completedOrders, previous: previous.completedOrders },
    },
    {
      label: kpi.averageOrder,
      current: money(current.averageOrderMinor),
      previous: money(previous.averageOrderMinor),
      change: change(current.averageOrderMinor, previous.averageOrderMinor),
      raw: { current: current.averageOrderMinor, previous: previous.averageOrderMinor },
    },
    {
      label: kpi.identifiedCustomers,
      current: whole.format(current.identifiedCustomers),
      previous: whole.format(previous.identifiedCustomers),
      change: change(current.identifiedCustomers, previous.identifiedCustomers),
      raw: { current: current.identifiedCustomers, previous: previous.identifiedCustomers },
    },
    {
      label: overview.repeatRate,
      current: current.repeatRate === null ? kpi.unavailable : percent.format(current.repeatRate),
      previous: previous.repeatRate === null ? kpi.unavailable : percent.format(previous.repeatRate),
      // A rate moves in percentage points; a percentage of a percentage would be easy to misread.
      change:
        current.repeatRate === null || previous.repeatRate === null
          ? null
          : `${points.format((current.repeatRate - previous.repeatRate) * 100)} pp`,
      raw: { current: current.repeatRate, previous: previous.repeatRate },
    },
    {
      label: overview.refunded,
      current: money(current.refundedMinor),
      previous: money(previous.refundedMinor),
      change: change(current.refundedMinor, previous.refundedMinor),
      raw: { current: current.refundedMinor, previous: previous.refundedMinor },
    },
  ];
}
