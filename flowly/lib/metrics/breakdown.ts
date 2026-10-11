import type { Order } from "@/lib/domain/types";
import { groupKey, refundShares } from "./filters";

// Revenue split by channel, category or product. Only completed orders count,
// as in the headline figures, so the rows of any breakdown add up to net
// revenue exactly.

export type Dimension = "channel" | "category" | "product";
export const DIMENSIONS: readonly Dimension[] = ["channel", "category", "product"];

export type BreakdownRow = {
  key: string;
  netRevenueMinor: number;
  /** Completed orders that include it. An order with two products is in both rows, so this column does not add up to the order count. */
  orders: number;
  /** Items sold. */
  units: number;
  /** Share of the revenue of all rows; null when there is none. */
  share: number | null;
};

/** Orders must already be narrowed to the range and the filters. Sorted by revenue, largest first. */
export function breakdown(orders: readonly Order[], dimension: Dimension): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  const row = (key: string) => {
    let found = rows.get(key);
    if (!found) rows.set(key, (found = { key, netRevenueMinor: 0, orders: 0, units: 0, share: null }));
    return found;
  };

  for (const order of orders) {
    if (order.status !== "completed") continue;

    if (dimension === "channel") {
      const target = row(groupKey(order.channel));
      target.netRevenueMinor += order.netMinor - order.refundMinor;
      target.orders += 1;
      for (const line of order.lines) target.units += line.quantity;
      continue;
    }

    const shares = refundShares(order);
    const seen = new Set<string>();
    order.lines.forEach((line, index) => {
      const key = groupKey(dimension === "category" ? line.category : line.productName);
      const target = row(key);
      target.netRevenueMinor += line.netMinor - shares[index];
      target.units += line.quantity;
      if (!seen.has(key)) {
        seen.add(key);
        target.orders += 1;
      }
    });
  }

  const total = [...rows.values()].reduce((sum, item) => sum + item.netRevenueMinor, 0);
  return [...rows.values()]
    .map((item) => ({ ...item, share: total === 0 ? null : item.netRevenueMinor / total }))
    .sort((a, b) => b.netRevenueMinor - a.netRevenueMinor || a.key.localeCompare(b.key, "en"));
}
