import type { DayRange, Order } from "@/lib/domain/types";
import { addDays, dayKey, daysIn, inRange } from "@/lib/time";

// Revenue and orders over time. A bucket is a day, a week (Monday to Sunday)
// or a calendar month, cut off at the ends of the range, so the buckets of a
// range always add up to the range's own totals.

export type Granularity = "day" | "week" | "month";
export const GRANULARITIES: readonly Granularity[] = ["day", "week", "month"];

export type Bucket = {
  /** First and last day of the bucket inside the range. */
  from: string;
  to: string;
  netRevenueMinor: number;
  completedOrders: number;
};

const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** The last day of the bucket a day belongs to. */
function bucketEnd(day: string, granularity: Granularity): string {
  if (granularity === "day") return day;
  if (granularity === "week") return addDays(day, (7 - weekday(day)) % 7);
  const [year, month] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** The granularity that keeps a chart readable for a range of this length. */
export function defaultGranularity(range: DayRange): Granularity {
  const days = daysIn(range);
  return days <= 45 ? "day" : days <= 200 ? "week" : "month";
}

export function timeSeries(orders: readonly Order[], range: DayRange, timezone: string, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = [];
  const index = new Map<string, Bucket>();

  for (let from = range.from; from <= range.to;) {
    const end = bucketEnd(from, granularity);
    const to = end > range.to ? range.to : end;
    const bucket: Bucket = { from, to, netRevenueMinor: 0, completedOrders: 0 };
    buckets.push(bucket);
    for (let day = from; day <= to; day = addDays(day, 1)) index.set(day, bucket);
    from = addDays(to, 1);
  }

  for (const order of orders) {
    if (order.status !== "completed") continue;
    const day = dayKey(order.placedAt, timezone);
    if (!inRange(day, range)) continue;
    const bucket = index.get(day)!;
    bucket.netRevenueMinor += order.netMinor - order.refundMinor;
    bucket.completedOrders += 1;
  }
  return buckets;
}

/** A bucket's label for an axis or a table: "Sep 14", "Sep 14 – 20", "Sep 2026". */
export function bucketLabel(bucket: Bucket, granularity: Granularity, locale = "en-US"): string {
  const date = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(Date.parse(`${day}T00:00:00Z`));
  if (granularity === "month") return date(bucket.from, { month: "short", year: "numeric" });
  if (granularity === "day" || bucket.from === bucket.to) return date(bucket.from, { month: "short", day: "numeric" });
  const sameMonth = bucket.from.slice(0, 7) === bucket.to.slice(0, 7);
  return `${date(bucket.from, { month: "short", day: "numeric" })} – ${date(bucket.to, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
}
