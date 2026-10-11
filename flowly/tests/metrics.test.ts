import { describe, expect, it } from "vitest";
import type { Order, OrderStatus } from "@/lib/domain/types";
import { compare, delta, ordersIn, summarize } from "@/lib/metrics/summary";

const TZ = "America/New_York";

/** An order with one line, placed at a New York wall-clock time in October 2026 (UTC−4). */
function order(
  id: string,
  day: number,
  netMinor: number,
  status: OrderStatus = "completed",
  customerId: string | null = null,
  refundMinor = 0,
  hour = 12,
): Order {
  const line = {
    productName: "Thing",
    category: "Things",
    quantity: 1,
    unitPriceMinor: netMinor,
    grossMinor: netMinor,
    discountMinor: 0,
    netMinor,
  };
  return {
    id,
    externalId: id,
    placedAt: Date.UTC(2026, 9, day, hour + 4),
    customerId,
    channel: "Direct",
    status,
    lines: [line],
    grossMinor: netMinor,
    discountMinor: 0,
    netMinor,
    refundMinor: status === "refunded" ? netMinor : refundMinor,
  };
}

// A week worked out by hand. Days 8–14 are "this week", days 1–7 "last week".
const fixture: Order[] = [
  order("a1", 8, 5000, "completed", "ann"),
  order("a2", 9, 3000, "completed", "ann"),
  order("b1", 9, 2000, "completed", "bob"),
  order("g1", 10, 1000, "completed", null),
  order("c1", 11, 4000, "completed", "cy", 1500), // partly refunded
  order("r1", 12, 7000, "refunded", "dee"),
  order("x1", 13, 9000, "cancelled", "eve"),
  order("p1", 14, 2500, "pending", "fay"),
  // last week
  order("l1", 2, 6000, "completed", "ann"),
  order("l2", 5, 2000, "completed", null),
];

describe("summary", () => {
  const week = summarize(ordersIn(fixture, { from: "2026-10-08", to: "2026-10-14" }, TZ));

  it("counts revenue from completed orders only, less what was refunded on them", () => {
    // 5000 + 3000 + 2000 + 1000 + (4000 − 1500)
    expect(week.netRevenueMinor).toBe(13500);
  });

  it("counts completed orders, not cancelled, pending or refunded ones", () => {
    expect(week.completedOrders).toBe(5);
    expect(week.byStatus).toEqual({ completed: 5, refunded: 1, cancelled: 1, pending: 1 });
  });

  it("divides revenue by completed orders for the average", () => {
    expect(week.averageOrderMinor).toBe(2700);
  });

  it("counts known customers once each and never invents one for a guest order", () => {
    // ann, bob, cy. The guest order adds revenue and an order, not a customer.
    expect(week.identifiedCustomers).toBe(3);
    expect(week.anonymousOrders).toBe(1);
  });

  it("takes the repeat rate over customers with a completed order in the range", () => {
    // Only ann ordered twice: 1 of 3.
    expect(week.repeatRate).toBeCloseTo(1 / 3, 10);
  });

  it("adds up money given back: full refunds and partial ones", () => {
    expect(week.refundedMinor).toBe(8500);
  });

  it("has no average and no repeat rate when there is nothing to divide by", () => {
    const empty = summarize([]);
    expect(empty).toMatchObject({
      netRevenueMinor: 0,
      completedOrders: 0,
      averageOrderMinor: null,
      identifiedCustomers: 0,
      repeatRate: null,
    });
  });
});

describe("days are decided in the workspace time zone", () => {
  it("puts a late-evening order on its local day, not the UTC one", () => {
    // 23:30 in New York on the 10th is 03:30 UTC on the 11th.
    const late = order("late", 10, 1000, "completed", null, 0, 23.5);
    expect(new Date(late.placedAt).toISOString().slice(0, 10)).toBe("2026-10-11");
    expect(ordersIn([late], { from: "2026-10-10", to: "2026-10-10" }, TZ)).toHaveLength(1);
    expect(ordersIn([late], { from: "2026-10-11", to: "2026-10-11" }, TZ)).toHaveLength(0);
    // The same instant belongs to the 11th for a shop in Tokyo.
    expect(ordersIn([late], { from: "2026-10-11", to: "2026-10-11" }, "Asia/Tokyo")).toHaveLength(1);
  });
});

describe("period comparison", () => {
  it("compares with the same number of days just before", () => {
    const result = compare(fixture, { from: "2026-10-08", to: "2026-10-14" }, TZ);
    expect(result.previousRange).toEqual({ from: "2026-10-01", to: "2026-10-07" });
    expect(result.previous.netRevenueMinor).toBe(8000);
    expect(result.previous.completedOrders).toBe(2);
    const change = delta(result.current.netRevenueMinor, result.previous.netRevenueMinor);
    expect(change).toEqual({ absolute: 5500, ratio: 0.6875 });
  });

  it("gives no percentage when the earlier period had nothing", () => {
    expect(delta(500, 0)).toEqual({ absolute: 500, ratio: null });
  });

  it("gives no change at all when a side has no value", () => {
    expect(delta(null, 100)).toBeNull();
    expect(delta(100, null)).toBeNull();
  });
});
