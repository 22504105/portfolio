import type { Customer, Order } from "@/lib/domain/types";
import { customerLabel, customerStats, type CustomerStats } from "@/lib/metrics/customers";
import type { PageData } from "@/lib/workspace";

// The rows of the two big tables: searched and sorted here, so the page and
// the CSV export list exactly the same things in the same order.

export const TRANSACTION_SORTS = ["date", "amount", "order", "status"] as const;
export const CUSTOMER_SORTS = ["spend", "orders", "lifetime", "last", "name"] as const;
export const TRANSACTIONS_PER_PAGE = 25;
export const CUSTOMERS_PER_PAGE = 20;

const has = (value: string | null | undefined, needle: string) => !!value && value.toLowerCase().includes(needle);

export function customerIndex(customers: readonly Customer[]): Map<string, Customer> {
  return new Map(customers.map((customer) => [customer.id, customer]));
}

/** The orders of the period that pass the filters and the search, in the chosen order. */
export function transactionRows(page: PageData): Order[] {
  const { view, inPeriod, context } = page;
  const customers = customerIndex(context.dataset.customers);
  const needle = view.query.toLowerCase();

  const rows = needle
    ? inPeriod.filter((order) => {
        const customer = order.customerId ? customers.get(order.customerId) : undefined;
        return (
          has(order.externalId, needle) ||
          has(order.channel, needle) ||
          has(customer?.name, needle) ||
          has(customer?.email, needle) ||
          has(customer?.externalId, needle) ||
          order.lines.some((line) => has(line.productName, needle))
        );
      })
    : [...inPeriod];

  const direction = view.descending ? -1 : 1;
  const compare: Record<string, (a: Order, b: Order) => number> = {
    date: (a, b) => a.placedAt - b.placedAt,
    amount: (a, b) => a.netMinor - b.netMinor,
    order: (a, b) => a.externalId.localeCompare(b.externalId, "en", { numeric: true }),
    status: (a, b) => a.status.localeCompare(b.status),
  };
  const by = compare[view.sort] ?? compare.date;
  // Ties fall back to the date, newest first, so the order is always the same.
  return rows.sort((a, b) => direction * by(a, b) || b.placedAt - a.placedAt || a.externalId.localeCompare(b.externalId));
}

/** The customers with a completed order in the period, searched and sorted. */
export function customerRows(page: PageData): CustomerStats[] {
  const { view, filtered, context } = page;
  const { dataset } = context;
  const needle = view.query.toLowerCase();

  const all = customerStats(dataset.customers, dataset.orders, filtered, view.range, dataset.workspace.timezone);
  const rows = needle
    ? all.filter(({ customer }) => has(customer.name, needle) || has(customer.email, needle) || has(customer.externalId, needle))
    : all;

  const direction = view.descending ? -1 : 1;
  const compare: Record<string, (a: CustomerStats, b: CustomerStats) => number> = {
    spend: (a, b) => a.periodSpendMinor - b.periodSpendMinor,
    orders: (a, b) => a.periodOrders - b.periodOrders,
    lifetime: (a, b) => a.lifetimeSpendMinor - b.lifetimeSpendMinor,
    last: (a, b) => a.lastOrderAt - b.lastOrderAt,
    name: (a, b) => customerLabel(a.customer).localeCompare(customerLabel(b.customer), "en"),
  };
  const by = compare[view.sort] ?? compare.spend;
  return rows.sort((a, b) => direction * by(a, b) || b.periodSpendMinor - a.periodSpendMinor || a.customer.id.localeCompare(b.customer.id));
}

/** One page of rows, with the page number brought back into range. */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): { rows: T[]; page: number } {
  const last = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, last);
  return { rows: rows.slice((current - 1) * pageSize, current * pageSize), page: current };
}
