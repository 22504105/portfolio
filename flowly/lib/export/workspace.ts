import { breakdown } from "@/lib/metrics/breakdown";
import { getMessages } from "@/lib/i18n";
import { customerLabel } from "@/lib/metrics/customers";
import { reportRows } from "@/lib/metrics/report";
import { bucketLabel, timeSeries } from "@/lib/metrics/series";
import { minorToDecimalString } from "@/lib/money";
import { dayKey } from "@/lib/time";
import { CUSTOMER_SORTS, customerIndex, customerRows, TRANSACTION_SORTS, transactionRows } from "@/lib/view/lists";
import type { SearchParams } from "@/lib/view/state";
import { loadPage, type WorkspaceContext } from "@/lib/workspace";
import { csvResponse, toCsv } from "./csv";

// What each download contains. Every one is built from the same page data as
// the screen it is offered on, so a file never disagrees with what was shown.

export const EXPORT_KINDS = ["transactions", "customers", "breakdown", "series", "report"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export function isExportKind(value: string): value is ExportKind {
  return (EXPORT_KINDS as readonly string[]).includes(value);
}

/** An instant as local date and time in the workspace zone, in a form spreadsheets sort correctly. */
function localStamp(utcMs: number, timezone: string): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(utcMs);
  return `${dayKey(utcMs, timezone)} ${time}`;
}

export function exportCsv(context: WorkspaceContext, kind: ExportKind, params: SearchParams): Response {
  const { currency, timezone } = context.dataset.workspace;
  // Amounts go out as numbers, so a spreadsheet can add them up.
  const amount = (minor: number) => Number(minorToDecimalString(minor, currency));

  if (kind === "transactions") {
    const page = loadPage(context, "transactions", params, TRANSACTION_SORTS, "date");
    const customers = customerIndex(context.dataset.customers);
    const rows = transactionRows(page).map((order) => {
      const customer = order.customerId ? customers.get(order.customerId) : undefined;
      return [
        order.externalId,
        localStamp(order.placedAt, timezone),
        order.status,
        customer?.externalId,
        customer?.name,
        customer?.email,
        order.channel,
        order.lines.map((line) => `${line.quantity} x ${line.productName ?? "Not provided"}`).join("; "),
        order.lines.reduce((sum, line) => sum + line.quantity, 0),
        amount(order.grossMinor),
        amount(order.discountMinor),
        amount(order.netMinor),
        amount(order.refundMinor),
        currency,
      ];
    });
    const header = [
      "Order",
      `Placed (${timezone})`,
      "Status",
      "Customer ID",
      "Customer",
      "Email",
      "Channel",
      "Lines",
      "Items",
      "Gross",
      "Discount",
      "Net",
      "Refunded",
      "Currency",
    ];
    return csvResponse(`flowly-transactions-${page.view.range.from}-to-${page.view.range.to}.csv`, toCsv(header, rows));
  }

  if (kind === "customers") {
    const page = loadPage(context, "customers", params, CUSTOMER_SORTS, "spend");
    const rows = customerRows(page).map((row) => [
      row.customer.externalId,
      customerLabel(row.customer),
      row.customer.email,
      row.periodOrders,
      amount(row.periodSpendMinor),
      row.lifetimeOrders,
      amount(row.lifetimeSpendMinor),
      dayKey(row.firstOrderAt, timezone),
      dayKey(row.lastOrderAt, timezone),
      row.segment,
      row.repeat ? "yes" : "no",
      currency,
    ]);
    const header = [
      "Customer ID",
      "Customer",
      "Email",
      "Orders in period",
      "Spend in period",
      "Orders all time",
      "Spend all time",
      "First order",
      "Last order",
      "Segment",
      "Repeat buyer",
      "Currency",
    ];
    return csvResponse(`flowly-customers-${page.view.range.from}-to-${page.view.range.to}.csv`, toCsv(header, rows));
  }

  const page = loadPage(context, "analytics", params);
  const { view } = page;

  if (kind === "report") {
    // The summary table of the printed report: the same rows, with raw values a spreadsheet can use.
    const scale = (value: number | null, isMoney: boolean) => (value === null ? null : isMoney ? amount(value) : value);
    const rows = reportRows(page.comparison, currency, getMessages()).map((row, index) => {
      const isMoney = index === 0 || index === 2 || index === 5;
      const isRate = index === 4;
      const value = (raw: number | null) => (isRate && raw !== null ? Number((raw * 100).toFixed(2)) : scale(raw, isMoney));
      return [row.label + (isRate ? " (%)" : ""), value(row.raw.current), value(row.raw.previous), row.change ?? ""];
    });
    const header = [
      "Figure",
      `This period (${view.range.from} to ${view.range.to})`,
      `Previous period (${page.comparison.previousRange.from} to ${page.comparison.previousRange.to})`,
      "Change",
    ];
    return csvResponse(`flowly-report-${view.range.from}-to-${view.range.to}.csv`, toCsv(header, rows));
  }

  if (kind === "breakdown") {
    const rows = breakdown(page.inPeriod, view.dimension).map((row) => [
      row.key,
      amount(row.netRevenueMinor),
      row.share === null ? null : Number((row.share * 100).toFixed(2)),
      row.orders,
      row.units,
      currency,
    ]);
    const header = [view.dimension[0].toUpperCase() + view.dimension.slice(1), "Net revenue", "Share %", "Orders", "Units", "Currency"];
    return csvResponse(`flowly-by-${view.dimension}-${view.range.from}-to-${view.range.to}.csv`, toCsv(header, rows));
  }

  const rows = timeSeries(page.filtered, view.range, timezone, view.granularity).map((bucket) => [
    bucket.from,
    bucket.to,
    bucketLabel(bucket, view.granularity),
    amount(bucket.netRevenueMinor),
    bucket.completedOrders,
    currency,
  ]);
  return csvResponse(
    `flowly-revenue-by-${view.granularity}-${view.range.from}-to-${view.range.to}.csv`,
    toCsv(["From", "To", "Period", "Net revenue", "Completed orders", "Currency"], rows),
  );
}
