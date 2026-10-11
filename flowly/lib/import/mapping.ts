import { FIELDS, type Field, type ImportOptions, type Mapping, type Table } from "./types";
import { cellText, detectDateOrder } from "./values";

// Guessing which column is which from its heading. It is only ever a
// suggestion: the wizard shows it, and the user confirms or changes it.

const SYNONYMS: Record<Field, readonly string[]> = {
  orderId: [
    "order id",
    "order",
    "order number",
    "order no",
    "order #",
    "orderid",
    "transaction id",
    "transaction",
    "invoice",
    "invoice number",
    "receipt",
    "reference",
    "id",
  ],
  orderDate: [
    "order date",
    "date",
    "created at",
    "created",
    "placed at",
    "purchase date",
    "transaction date",
    "paid at",
    "timestamp",
    "datetime",
    "time",
  ],
  amount: ["net amount", "amount", "total", "net", "order total", "line total", "subtotal", "revenue", "sales", "price paid", "paid"],
  quantity: ["quantity", "qty", "units", "items", "count"],
  unitPrice: ["unit price", "price", "item price", "price each", "unit cost"],
  discount: ["discount", "discount amount", "discounts", "coupon amount"],
  refund: ["refund", "refunded", "refund amount", "refunded amount"],
  status: ["status", "order status", "payment status", "state", "fulfillment status"],
  customerId: ["customer id", "customer number", "customer no", "client id", "user id", "buyer id", "customerid"],
  customerName: ["customer name", "customer", "client", "name", "buyer", "full name", "billing name"],
  customerEmail: ["customer email", "email", "e mail", "email address", "buyer email"],
  product: ["product", "product name", "item", "item name", "sku", "title", "description", "lineitem name"],
  category: ["category", "product category", "type", "product type", "department", "collection"],
  channel: ["channel", "source", "sales channel", "marketing channel", "utm source", "referrer", "medium"],
  currency: ["currency", "currency code"],
};

const normalise = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/[^a-z0-9# ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** A first guess at the mapping. A column is given to one field only, the best match first. */
export function suggestMapping(headers: readonly string[]): Mapping {
  const names = headers.map(normalise);
  const taken = new Set<number>();
  const mapping: Mapping = {};
  // Earlier synonyms are better matches, so every field tries its best one before any field tries a worse one.
  const rounds = Math.max(...FIELDS.map((field) => SYNONYMS[field].length));
  for (let rank = 0; rank < rounds; rank++) {
    for (const field of FIELDS) {
      if (mapping[field] !== undefined) continue;
      const synonym = SYNONYMS[field][rank];
      if (!synonym) continue;
      const column = names.findIndex((name, index) => name === synonym && !taken.has(index));
      if (column !== -1) {
        mapping[field] = column;
        taken.add(column);
      }
    }
  }
  return mapping;
}

/** The first few values of a column that are not empty, to show beside the menu that maps it. */
export function sampleValues(table: Table, column: number, count = 3): string[] {
  const samples: string[] = [];
  for (const row of table.rows) {
    const text = cellText(row[column]);
    if (text) samples.push(text.length > 40 ? `${text.slice(0, 39)}…` : text);
    if (samples.length === count) break;
  }
  return samples;
}

/** Sensible starting options for a file, given a mapping. Nothing here is final. */
export function suggestOptions(table: Table, mapping: Mapping): ImportOptions {
  let interpretation: ImportOptions["interpretation"] = "order_per_row";
  if (mapping.orderId !== undefined) {
    const seen = new Set<string>();
    for (const row of table.rows) {
      const id = cellText(row[mapping.orderId]);
      if (!id) continue;
      // The same order number on several rows is what a file of order lines looks like.
      if (seen.has(id)) {
        interpretation = "line_per_row";
        break;
      }
      seen.add(id);
    }
  }
  const detected = mapping.orderDate === undefined ? "none" : dateOrderOf(table, mapping.orderDate);
  return {
    interpretation,
    dateOrder: detected === "dmy" || detected === "mdy" ? detected : null,
    defaultStatus: null,
    generateIds: false,
    duplicates: "skip",
  };
}

export function dateOrderOf(table: Table, column: number) {
  return detectDateOrder(table.rows.map((row) => (typeof row[column] === "string" ? cellText(row[column]) : "")));
}

/** What the mapping still lacks before validation can run. Field names, or "amount" for the amount-or-price rule. */
export function missingRequired(mapping: Mapping, options: ImportOptions): Field[] {
  const missing: Field[] = [];
  if (mapping.orderId === undefined && !(options.generateIds && options.interpretation === "order_per_row")) missing.push("orderId");
  if (mapping.orderDate === undefined) missing.push("orderDate");
  if (mapping.amount === undefined && (mapping.quantity === undefined || mapping.unitPrice === undefined)) missing.push("amount");
  return missing;
}
