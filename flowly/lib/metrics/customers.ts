import type { Customer, DayRange, Order } from "@/lib/domain/types";
import { dayKey, inRange } from "@/lib/time";

// What is known about each customer. Only orders that name a customer are
// here: guest orders belong to nobody and nobody is invented for them.

export type Segment = "new" | "returning";

export type CustomerStats = {
  customer: Customer;
  /** Completed orders in the period, and what they brought in. */
  periodOrders: number;
  periodSpendMinor: number;
  /** Completed orders ever, and what they brought in. */
  lifetimeOrders: number;
  lifetimeSpendMinor: number;
  /** UTC milliseconds of the first and the latest completed order ever. */
  firstOrderAt: number;
  lastOrderAt: number;
  /** New: the first completed order ever falls inside the period. Returning: it came before. */
  segment: Segment;
  /** Two or more completed orders ever. */
  repeat: boolean;
};

/**
 * The customers with a completed order in the period.
 *
 * `periodOrders` are orders narrowed to the filters (and may be narrowed to
 * the range or not: the range is applied here). `allOrders` are every order
 * of the workspace, unfiltered, for the lifetime columns.
 */
export function customerStats(
  customers: readonly Customer[],
  allOrders: readonly Order[],
  filteredOrders: readonly Order[],
  range: DayRange,
  timezone: string,
): CustomerStats[] {
  const byId = new Map(customers.map((customer) => [customer.id, customer]));
  const lifetime = new Map<string, { orders: number; spend: number; first: number; last: number }>();

  for (const order of allOrders) {
    if (order.status !== "completed" || order.customerId === null) continue;
    const entry = lifetime.get(order.customerId);
    const spend = order.netMinor - order.refundMinor;
    if (!entry) lifetime.set(order.customerId, { orders: 1, spend, first: order.placedAt, last: order.placedAt });
    else {
      entry.orders += 1;
      entry.spend += spend;
      entry.first = Math.min(entry.first, order.placedAt);
      entry.last = Math.max(entry.last, order.placedAt);
    }
  }

  const period = new Map<string, { orders: number; spend: number }>();
  for (const order of filteredOrders) {
    if (order.status !== "completed" || order.customerId === null) continue;
    if (!inRange(dayKey(order.placedAt, timezone), range)) continue;
    const entry = period.get(order.customerId) ?? { orders: 0, spend: 0 };
    entry.orders += 1;
    entry.spend += order.netMinor - order.refundMinor;
    period.set(order.customerId, entry);
  }

  const result: CustomerStats[] = [];
  for (const [id, inPeriod] of period) {
    const customer = byId.get(id);
    const ever = lifetime.get(id);
    if (!customer || !ever) continue;
    result.push({
      customer,
      periodOrders: inPeriod.orders,
      periodSpendMinor: inPeriod.spend,
      lifetimeOrders: ever.orders,
      lifetimeSpendMinor: ever.spend,
      firstOrderAt: ever.first,
      lastOrderAt: ever.last,
      segment: inRange(dayKey(ever.first, timezone), range) ? "new" : "returning",
      repeat: ever.orders >= 2,
    });
  }
  return result;
}

/** How a customer is shown when the name is missing: the email, then the ID. Never a made-up name. */
export function customerLabel(customer: Customer): string {
  return customer.name ?? customer.email ?? customer.externalId ?? customer.id;
}
