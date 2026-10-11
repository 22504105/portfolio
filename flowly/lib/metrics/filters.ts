import type { Order, OrderLine, OrderStatus } from "@/lib/domain/types";

// Narrowing orders before anything is calculated. Every page applies the same
// filters with this one function, then hands the result to the same metric
// functions: that is the whole reason filters act alike everywhere.

export type Filters = {
  /** Empty means every status. */
  statuses: OrderStatus[];
  channel: string | null;
  category: string | null;
  product: string | null;
};

export const NO_FILTERS: Filters = { statuses: [], channel: null, category: null, product: null };

/** What an order or a line without a value is grouped and filtered under. */
export const NOT_PROVIDED = "Not provided";

export const groupKey = (value: string | null) => value ?? NOT_PROVIDED;

/**
 * How much of an order's partial refund falls on each line: in proportion to
 * the line's net, in whole minor units, with the remainder on the last line so
 * the shares always add up to the refund exactly.
 */
export function refundShares(order: Order): number[] {
  if (order.refundMinor === 0 || order.netMinor === 0) return order.lines.map(() => 0);
  let left = order.refundMinor;
  return order.lines.map((line, index) => {
    const share =
      index === order.lines.length - 1 ? left : Math.min(left, Math.round((order.refundMinor * line.netMinor) / order.netMinor));
    left -= share;
    return share;
  });
}

const total = (lines: OrderLine[], field: "grossMinor" | "discountMinor" | "netMinor") => lines.reduce((sum, line) => sum + line[field], 0);

/**
 * The orders that pass the filters. Status and channel keep or drop whole
 * orders. Category and product work on lines: an order that matches keeps
 * only its matching lines, and its amounts (and its share of any refund) are
 * those of the lines that remain. So "revenue for Coffee" is the revenue of
 * coffee lines, not of every order that happened to include coffee.
 */
export function applyFilters(orders: readonly Order[], filters: Filters): Order[] {
  const { statuses, channel, category, product } = filters;
  const byLine = category !== null || product !== null;
  const result: Order[] = [];

  for (const order of orders) {
    if (statuses.length > 0 && !statuses.includes(order.status)) continue;
    if (channel !== null && groupKey(order.channel) !== channel) continue;
    if (!byLine) {
      result.push(order);
      continue;
    }

    const shares = refundShares(order);
    const lines: OrderLine[] = [];
    let refundMinor = 0;
    order.lines.forEach((line, index) => {
      if (category !== null && groupKey(line.category) !== category) return;
      if (product !== null && groupKey(line.productName) !== product) return;
      lines.push(line);
      refundMinor += shares[index];
    });
    if (lines.length === 0) continue;

    const netMinor = total(lines, "netMinor");
    result.push({
      ...order,
      lines,
      grossMinor: total(lines, "grossMinor"),
      discountMinor: total(lines, "discountMinor"),
      netMinor,
      // A fully refunded order stays fully refunded, whatever is left of it.
      refundMinor: order.status === "refunded" ? netMinor : refundMinor,
    });
  }
  return result;
}

export function hasFilters(filters: Filters): boolean {
  return filters.statuses.length > 0 || filters.channel !== null || filters.category !== null || filters.product !== null;
}

/** The values a workspace has for each filter, for the menus. Sorted, "Not provided" last. */
export function filterOptions(orders: readonly Order[]) {
  const channels = new Set<string>();
  const categories = new Set<string>();
  const products = new Set<string>();
  for (const order of orders) {
    channels.add(groupKey(order.channel));
    for (const line of order.lines) {
      categories.add(groupKey(line.category));
      products.add(groupKey(line.productName));
    }
  }
  const sorted = (values: Set<string>) =>
    [...values].sort((a, b) => (a === NOT_PROVIDED ? 1 : b === NOT_PROVIDED ? -1 : a.localeCompare(b, "en")));
  return { channels: sorted(channels), categories: sorted(categories), products: sorted(products) };
}
