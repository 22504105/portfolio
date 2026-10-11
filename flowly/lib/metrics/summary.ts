import type { DayRange, Order } from "@/lib/domain/types";
import { dayKey, inRange, previousRange } from "@/lib/time";

// The headline figures. docs/metrics.md defines each one in words; this file
// is those definitions and nothing else. Every page calls these functions on
// the same orders, which is why no two pages can disagree.

export type Summary = {
  /** Net of completed orders, less what was refunded on them. */
  netRevenueMinor: number;
  /** Completed orders. One order with five lines is one order. */
  completedOrders: number;
  /** Net revenue ÷ completed orders; null when there are none. */
  averageOrderMinor: number | null;
  /** Distinct known customers with a completed order. */
  identifiedCustomers: number;
  /** Completed orders that name no customer. They count as orders and as revenue, never as customers. */
  anonymousOrders: number;
  /** Of the identified customers, the share with two or more completed orders in the range; null when there are none. */
  repeatRate: number | null;
  /** Money given back: refunded orders in full plus partial refunds on completed ones. */
  refundedMinor: number;
  byStatus: Record<Order["status"], number>;
};

/** The orders placed on the days of a range, in the workspace time zone. */
export function ordersIn(orders: readonly Order[], range: DayRange, timezone: string): Order[] {
  return orders.filter((order) => inRange(dayKey(order.placedAt, timezone), range));
}

/** Summarises orders that have already been narrowed to a range and to filters. */
export function summarize(orders: readonly Order[]): Summary {
  const byStatus: Summary["byStatus"] = { completed: 0, refunded: 0, cancelled: 0, pending: 0 };
  const ordersPerCustomer = new Map<string, number>();
  let netRevenueMinor = 0;
  let refundedMinor = 0;
  let anonymousOrders = 0;

  for (const order of orders) {
    byStatus[order.status] += 1;
    if (order.status === "refunded") refundedMinor += order.netMinor;
    if (order.status !== "completed") continue;

    netRevenueMinor += order.netMinor - order.refundMinor;
    refundedMinor += order.refundMinor;
    if (order.customerId === null) anonymousOrders += 1;
    else ordersPerCustomer.set(order.customerId, (ordersPerCustomer.get(order.customerId) ?? 0) + 1);
  }

  const completedOrders = byStatus.completed;
  const identifiedCustomers = ordersPerCustomer.size;
  let repeating = 0;
  for (const count of ordersPerCustomer.values()) if (count >= 2) repeating += 1;

  return {
    netRevenueMinor,
    completedOrders,
    // Whole minor units: half a cent is not money.
    averageOrderMinor: completedOrders === 0 ? null : Math.round(netRevenueMinor / completedOrders),
    identifiedCustomers,
    anonymousOrders,
    repeatRate: identifiedCustomers === 0 ? null : repeating / identifiedCustomers,
    refundedMinor,
    byStatus,
  };
}

export type Delta = {
  /** current − previous. */
  absolute: number;
  /** The change as a share of the previous value; null when the previous value is zero. */
  ratio: number | null;
};

/** How a figure moved. Null when either side has no value to compare. */
export function delta(current: number | null, previous: number | null): Delta | null {
  if (current === null || previous === null) return null;
  return { absolute: current - previous, ratio: previous === 0 ? null : (current - previous) / Math.abs(previous) };
}

export type Comparison = { range: DayRange; previousRange: DayRange; current: Summary; previous: Summary };

/**
 * A range against the range of the same length just before it. Pass orders
 * that are already filtered by everything except dates, so both periods are
 * seen through the same filters.
 */
export function compare(orders: readonly Order[], range: DayRange, timezone: string): Comparison {
  const before = previousRange(range);
  return {
    range,
    previousRange: before,
    current: summarize(ordersIn(orders, range, timezone)),
    previous: summarize(ordersIn(orders, before, timezone)),
  };
}
