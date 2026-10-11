// The shapes every page and every calculation works with. The demo generator
// and the database both produce exactly these, so nothing downstream knows or
// cares where a workspace's data came from.
//
// Money is always a whole number of minor units (cents for USD) in the
// workspace currency: see lib/money.ts. Instants are UTC milliseconds; which
// calendar day one falls on depends on the workspace time zone: see lib/time.ts.

export type OrderStatus = "completed" | "refunded" | "cancelled" | "pending";

export const ORDER_STATUSES: readonly OrderStatus[] = ["completed", "refunded", "cancelled", "pending"];

/** One product on an order. An order imported as "one order per row" has exactly one line. */
export type OrderLine = {
  productName: string | null;
  category: string | null;
  quantity: number;
  unitPriceMinor: number;
  /** quantity × unit price. */
  grossMinor: number;
  discountMinor: number;
  /** gross − discount. */
  netMinor: number;
};

export type Order = {
  id: string;
  /** The identifier in the source data. Unique within a workspace. */
  externalId: string;
  /** When the order was placed, UTC milliseconds. */
  placedAt: number;
  /** Null when the source did not say who bought: such orders belong to no customer. */
  customerId: string | null;
  channel: string | null;
  status: OrderStatus;
  lines: OrderLine[];
  /** Sums of the lines. */
  grossMinor: number;
  discountMinor: number;
  netMinor: number;
  /**
   * Money given back on a completed order (a partial refund). An order
   * refunded in full has the status "refunded" instead and this equal to net.
   */
  refundMinor: number;
};

export type Customer = {
  id: string;
  externalId: string | null;
  name: string | null;
  email: string | null;
};

export type Workspace = {
  id: string;
  name: string;
  /** ISO 4217, e.g. "USD". Every amount in the workspace is in this currency. */
  currency: string;
  /** IANA name, e.g. "America/New_York". Days begin and end in this zone. */
  timezone: string;
};

/** Everything a workspace holds, loaded once and calculated from in memory. */
export type Dataset = {
  workspace: Workspace;
  orders: Order[];
  customers: Customer[];
  /** Where the data came from, shown next to the figures. */
  provenance: { kind: "demo" } | { kind: "imports"; batches: number };
};

/** An inclusive range of calendar days in the workspace time zone, "YYYY-MM-DD". */
export type DayRange = { from: string; to: string };
