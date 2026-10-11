import { describe, expect, it } from "vitest";
import { createRandom, DEMO_DEFAULT_RANGE, DEMO_FIRST_DAY, DEMO_LAST_DAY, demoDataset } from "@/lib/demo/dataset";
import { ordersIn, summarize } from "@/lib/metrics/summary";
import { dayKey } from "@/lib/time";

const data = demoDataset();
const { timezone } = data.workspace;

describe("the seeded generator", () => {
  it("gives the same sequence for the same seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect(Array.from({ length: 5 }, a.next)).toEqual(Array.from({ length: 5 }, b.next));
    expect(createRandom(43).next()).not.toBe(createRandom(42).next());
  });
});

describe("the demo dataset", () => {
  it("has the size the brief asks for", () => {
    expect(data.orders.length).toBeGreaterThanOrEqual(3000);
    expect(data.orders.length).toBeLessThanOrEqual(8000);
    expect(data.customers.length).toBeGreaterThanOrEqual(500);
    expect(data.customers.length).toBeLessThanOrEqual(1500);
    const products = new Set(data.orders.flatMap((order) => order.lines.map((line) => line.productName)));
    expect(products.size).toBeGreaterThanOrEqual(20);
    expect(products.size).toBeLessThanOrEqual(50);
    const channels = new Set(data.orders.map((order) => order.channel));
    expect(channels.size).toBeGreaterThanOrEqual(4);
    expect(channels.size).toBeLessThanOrEqual(6);
  });

  it("is pinned: these figures change only if the generator does", () => {
    const all = summarize(data.orders);
    expect({ orders: data.orders.length, customers: data.customers.length, revenue: all.netRevenueMinor }).toMatchSnapshot();
  });

  it("stays inside its dates", () => {
    const days = data.orders.map((order) => dayKey(order.placedAt, timezone));
    expect(days.reduce((a, b) => (a < b ? a : b))).toBe(DEMO_FIRST_DAY);
    expect(days.reduce((a, b) => (a > b ? a : b))).toBe(DEMO_LAST_DAY);
  });

  it("adds up: every order is the sum of its lines, every line is quantity × price less discount", () => {
    for (const order of data.orders) {
      expect(order.lines.length).toBeGreaterThan(0);
      for (const line of order.lines) {
        expect(Number.isInteger(line.quantity) && line.quantity > 0).toBe(true);
        expect(line.grossMinor).toBe(line.quantity * line.unitPriceMinor);
        expect(line.netMinor).toBe(line.grossMinor - line.discountMinor);
        expect(line.discountMinor).toBeGreaterThanOrEqual(0);
      }
      expect(order.netMinor).toBe(order.lines.reduce((total, line) => total + line.netMinor, 0));
      expect(order.grossMinor - order.discountMinor).toBe(order.netMinor);
      expect(order.refundMinor).toBeGreaterThanOrEqual(0);
      expect(order.refundMinor).toBeLessThanOrEqual(order.netMinor);
      if (order.status === "refunded") expect(order.refundMinor).toBe(order.netMinor);
      if (order.status === "cancelled" || order.status === "pending") expect(order.refundMinor).toBe(0);
    }
  });

  it("has unique order numbers and only customers who exist", () => {
    expect(new Set(data.orders.map((order) => order.externalId)).size).toBe(data.orders.length);
    const known = new Set(data.customers.map((customer) => customer.id));
    for (const order of data.orders) if (order.customerId !== null) expect(known.has(order.customerId)).toBe(true);
    // Every customer in the list bought at least once.
    expect(new Set(data.orders.map((order) => order.customerId).filter(Boolean)).size).toBe(data.customers.length);
  });

  it("uses invented people only", () => {
    for (const customer of data.customers) expect(customer.email).toMatch(/@example\.com$/);
  });

  it("has guests, repeat customers, refunds, cancellations and orders in progress", () => {
    const all = summarize(data.orders);
    expect(all.anonymousOrders).toBeGreaterThan(100);
    expect(all.repeatRate).toBeGreaterThan(0.3);
    expect(all.byStatus.refunded).toBeGreaterThan(50);
    expect(all.byStatus.cancelled).toBeGreaterThan(50);
    expect(all.byStatus.pending).toBeGreaterThan(0);
    expect(data.orders.some((order) => order.status === "completed" && order.refundMinor > 0)).toBe(true);
  });

  it("is seasonal: December outsells February", () => {
    const december = summarize(ordersIn(data.orders, { from: "2025-12-01", to: "2025-12-31" }, timezone));
    const february = summarize(ordersIn(data.orders, { from: "2026-02-01", to: "2026-02-28" }, timezone));
    expect(december.netRevenueMinor).toBeGreaterThan(february.netRevenueMinor * 1.3);
  });

  it("opens on a month that has something to show", () => {
    expect(summarize(ordersIn(data.orders, DEMO_DEFAULT_RANGE, timezone)).completedOrders).toBeGreaterThan(200);
  });
});
