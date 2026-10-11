import { describe, expect, it } from "vitest";
import { DEMO_FIRST_DAY, DEMO_LAST_DAY, demoDataset } from "@/lib/demo/dataset";
import type { DayRange, Order, OrderLine } from "@/lib/domain/types";
import { breakdown, DIMENSIONS } from "@/lib/metrics/breakdown";
import { customerStats } from "@/lib/metrics/customers";
import { applyFilters, filterOptions, NO_FILTERS, NOT_PROVIDED, refundShares } from "@/lib/metrics/filters";
import { bucketLabel, defaultGranularity, GRANULARITIES, timeSeries } from "@/lib/metrics/series";
import { ordersIn, summarize } from "@/lib/metrics/summary";

const data = demoDataset();
const tz = data.workspace.timezone;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const RANGES: DayRange[] = [
  { from: "2026-09-01", to: "2026-09-30" },
  { from: "2025-11-17", to: "2026-01-04" }, // crosses the clock change and the new year
  { from: DEMO_FIRST_DAY, to: DEMO_LAST_DAY },
  { from: "2026-03-08", to: "2026-03-08" }, // one day, the day clocks go forward
];

const line = (productName: string | null, category: string | null, netMinor: number, quantity = 1): OrderLine => ({
  productName,
  category,
  quantity,
  unitPriceMinor: netMinor / quantity,
  grossMinor: netMinor,
  discountMinor: 0,
  netMinor,
});

function order(id: string, lines: OrderLine[], extra: Partial<Order> = {}): Order {
  const netMinor = sum(lines.map((item) => item.netMinor));
  return {
    id,
    externalId: id,
    placedAt: Date.UTC(2026, 8, 15, 16),
    customerId: null,
    channel: "Direct",
    status: "completed",
    lines,
    grossMinor: netMinor,
    discountMinor: 0,
    netMinor,
    refundMinor: 0,
    ...extra,
  };
}

describe("refund shares", () => {
  it("split a partial refund across lines and always add up to it", () => {
    const refunded = order("a", [line("Tea", "Tea", 1000), line("Mug", "Cups", 1000), line("Spoon", "Accessories", 1000)], {
      refundMinor: 1000,
    });
    const shares = refundShares(refunded);
    expect(shares).toEqual([333, 333, 334]);
    expect(sum(shares)).toBe(1000);
  });

  it("are zero when nothing was refunded", () => {
    expect(refundShares(order("a", [line("Tea", "Tea", 1000)]))).toEqual([0]);
  });

  it("add up for every order in the demo", () => {
    for (const item of data.orders) expect(sum(refundShares(item))).toBe(item.refundMinor);
  });
});

describe("filters", () => {
  const mixed = order("m", [line("Sencha", "Tea", 1400, 1), line("Mug", "Cups", 3600, 2)], { refundMinor: 500 });

  it("narrow an order to the lines that match, with their share of the refund", () => {
    const [tea] = applyFilters([mixed], { ...NO_FILTERS, category: "Tea" });
    expect(tea.lines).toHaveLength(1);
    expect(tea.netMinor).toBe(1400);
    expect(tea.refundMinor).toBe(140);
    const [cups] = applyFilters([mixed], { ...NO_FILTERS, category: "Cups" });
    expect(cups.netMinor + tea.netMinor).toBe(mixed.netMinor);
    expect(cups.refundMinor + tea.refundMinor).toBe(mixed.refundMinor);
  });

  it("drop an order with no matching line", () => {
    expect(applyFilters([mixed], { ...NO_FILTERS, product: "Kettle" })).toEqual([]);
  });

  it("keep or drop whole orders by status and channel", () => {
    const other = order("o", [line("Tea", "Tea", 100)], { status: "cancelled", channel: null });
    expect(applyFilters([mixed, other], { ...NO_FILTERS, statuses: ["cancelled"] })).toEqual([other]);
    expect(applyFilters([mixed, other], { ...NO_FILTERS, channel: NOT_PROVIDED })).toEqual([other]);
    expect(applyFilters([mixed, other], NO_FILTERS)).toHaveLength(2);
  });

  it("split the demo's revenue between categories with nothing lost and nothing counted twice", () => {
    const range = RANGES[0];
    const total = summarize(ordersIn(data.orders, range, tz)).netRevenueMinor;
    const parts = filterOptions(data.orders).categories.map(
      (category) => summarize(ordersIn(applyFilters(data.orders, { ...NO_FILTERS, category }), range, tz)).netRevenueMinor,
    );
    expect(sum(parts)).toBe(total);
  });
});

describe("time series", () => {
  it.each(RANGES)("buckets of $from – $to add up to the range's totals at every granularity", (range) => {
    const total = summarize(ordersIn(data.orders, range, tz));
    for (const granularity of GRANULARITIES) {
      const buckets = timeSeries(data.orders, range, tz, granularity);
      expect(sum(buckets.map((bucket) => bucket.netRevenueMinor))).toBe(total.netRevenueMinor);
      expect(sum(buckets.map((bucket) => bucket.completedOrders))).toBe(total.completedOrders);
      // Buckets tile the range: no gap, no overlap.
      expect(buckets[0].from).toBe(range.from);
      expect(buckets.at(-1)!.to).toBe(range.to);
    }
  });

  it("starts weeks on Monday and cuts the first and last at the range", () => {
    // 2026-09-01 is a Tuesday.
    const buckets = timeSeries([], { from: "2026-09-01", to: "2026-09-16" }, tz, "week");
    expect(buckets.map((bucket) => [bucket.from, bucket.to])).toEqual([
      ["2026-09-01", "2026-09-06"],
      ["2026-09-07", "2026-09-13"],
      ["2026-09-14", "2026-09-16"],
    ]);
  });

  it("uses calendar months", () => {
    const buckets = timeSeries([], { from: "2026-01-15", to: "2026-03-10" }, tz, "month");
    expect(buckets.map((bucket) => [bucket.from, bucket.to])).toEqual([
      ["2026-01-15", "2026-01-31"],
      ["2026-02-01", "2026-02-28"],
      ["2026-03-01", "2026-03-10"],
    ]);
    expect(bucketLabel(buckets[1], "month")).toBe("Feb 2026");
  });

  it("labels days and weeks", () => {
    expect(bucketLabel({ from: "2026-09-14", to: "2026-09-14", netRevenueMinor: 0, completedOrders: 0 }, "day")).toBe("Sep 14");
    expect(bucketLabel({ from: "2026-09-14", to: "2026-09-20", netRevenueMinor: 0, completedOrders: 0 }, "week")).toBe("Sep 14 – 20");
    expect(bucketLabel({ from: "2026-09-28", to: "2026-10-04", netRevenueMinor: 0, completedOrders: 0 }, "week")).toBe("Sep 28 – Oct 4");
  });

  it("picks a granularity that keeps the chart readable", () => {
    expect(defaultGranularity(RANGES[0])).toBe("day");
    expect(defaultGranularity({ from: "2026-07-03", to: "2026-09-30" })).toBe("week");
    expect(defaultGranularity(RANGES[2])).toBe("month");
  });
});

describe("breakdowns", () => {
  it.each(RANGES)("rows of $from – $to add up to net revenue for every dimension", (range) => {
    const orders = ordersIn(data.orders, range, tz);
    const total = summarize(orders);
    for (const dimension of DIMENSIONS) {
      const rows = breakdown(orders, dimension);
      expect(sum(rows.map((row) => row.netRevenueMinor))).toBe(total.netRevenueMinor);
      if (total.netRevenueMinor > 0) expect(sum(rows.map((row) => row.share ?? 0))).toBeCloseTo(1, 9);
    }
    // Every order has one channel, so there the order column adds up too.
    expect(sum(breakdown(orders, "channel").map((row) => row.orders))).toBe(total.completedOrders);
  });

  it("groups what has no value under its own name, and sorts by revenue", () => {
    const rows = breakdown([order("a", [line(null, null, 500)]), order("b", [line("Tea", "Tea", 900)])], "product");
    expect(rows.map((row) => [row.key, row.netRevenueMinor])).toEqual([
      ["Tea", 900],
      [NOT_PROVIDED, 500],
    ]);
  });

  it("counts an order once per product it contains, and units by quantity", () => {
    const rows = breakdown([order("a", [line("Tea", "Tea", 2800, 2), line("Mug", "Cups", 1800)])], "category");
    expect(rows).toEqual([
      { key: "Tea", netRevenueMinor: 2800, orders: 1, units: 2, share: 2800 / 4600 },
      { key: "Cups", netRevenueMinor: 1800, orders: 1, units: 1, share: 1800 / 4600 },
    ]);
  });
});

describe("customers", () => {
  it.each(RANGES)("for $from – $to: as many as the headline says, and their spend plus guest revenue is net revenue", (range) => {
    const inRange = ordersIn(data.orders, range, tz);
    const total = summarize(inRange);
    const stats = customerStats(data.customers, data.orders, data.orders, range, tz);
    expect(stats).toHaveLength(total.identifiedCustomers);
    const guests = sum(
      inRange.filter((item) => item.status === "completed" && item.customerId === null).map((item) => item.netMinor - item.refundMinor),
    );
    expect(sum(stats.map((item) => item.periodSpendMinor)) + guests).toBe(total.netRevenueMinor);
    expect(sum(stats.map((item) => item.periodOrders))).toBe(total.completedOrders - total.anonymousOrders);
    for (const item of stats) {
      expect(item.lifetimeOrders).toBeGreaterThanOrEqual(item.periodOrders);
      expect(item.lifetimeSpendMinor).toBeGreaterThanOrEqual(item.periodSpendMinor);
      expect(item.repeat).toBe(item.lifetimeOrders >= 2);
    }
  });

  it("calls a customer new only when their first order ever is in the period", () => {
    const early = order("e", [line("Tea", "Tea", 100)], { customerId: "c1", placedAt: Date.UTC(2026, 7, 10, 16) });
    const late = order("l", [line("Tea", "Tea", 100)], { customerId: "c1", placedAt: Date.UTC(2026, 8, 10, 16) });
    const fresh = order("f", [line("Tea", "Tea", 100)], { customerId: "c2", placedAt: Date.UTC(2026, 8, 12, 16) });
    const customers = [
      { id: "c1", externalId: null, name: "One", email: null },
      { id: "c2", externalId: null, name: "Two", email: null },
    ];
    const stats = customerStats(customers, [early, late, fresh], [early, late, fresh], RANGES[0], tz);
    expect(
      Object.fromEntries(stats.map((item) => [item.customer.id, [item.segment, item.repeat, item.periodOrders, item.lifetimeOrders]])),
    ).toEqual({
      c1: ["returning", true, 1, 2],
      c2: ["new", false, 1, 1],
    });
  });
});
