import type { OrderStatus } from "@/lib/domain/types";
import {
  LIMITS,
  type Cell,
  type Field,
  type ImportCustomer,
  type ImportLine,
  type ImportOptions,
  type ImportOrder,
  type Issue,
  type IssueCode,
  type Mapping,
  type Table,
  type Validation,
} from "./types";
import { cellText, isEmail, parseAmount, parseDate, parseQuantity, parseStatus } from "./values";

// Rows in, orders and issues out. A row with an error stays out of the import
// and is reported with its line number and the reason. Nothing is repaired
// silently: where a value is adjusted, a warning says how.

type Target = { currency: string; timezone: string };

type RowDraft = {
  row: number;
  externalId: string;
  placedAt: number;
  status: OrderStatus;
  channel: string | null;
  customer: ImportCustomer | null;
  line: ImportLine;
  refundMinor: number;
};

export function validate(
  table: Table,
  mapping: Mapping,
  options: ImportOptions,
  target: Target,
  existingIds: ReadonlySet<string>,
): Validation {
  const issues: Issue[] = [];
  const drafts: RowDraft[] = [];
  const rejected = new Set<number>();

  const column = (field: Field) => mapping[field];
  const has = (field: Field) => column(field) !== undefined;
  const generated = !has("orderId") && options.generateIds && options.interpretation === "order_per_row";

  table.rows.forEach((cells, index) => {
    const row = table.firstRowNumber + index;
    let failed = false;
    const raw = (field: Field): Cell | undefined => (has(field) ? cells[column(field)!] : undefined);
    const text = (field: Field) => cellText(raw(field));
    const report = (field: Field | null, code: IssueCode, message: string, severity: Issue["severity"] = "error") => {
      const value = field ? text(field) : "";
      issues.push({ row, field, code, severity, message, ...(value ? { value: value.slice(0, 80) } : {}) });
      if (severity === "error") failed = true;
    };
    /** Optional text: null when empty, refused when absurdly long. */
    const optional = (field: Field): string | null => {
      const value = text(field);
      if (!value) return null;
      if (value.length > LIMITS.cellLength) {
        report(field, "too_long", `Longer than ${LIMITS.cellLength} characters.`);
        return null;
      }
      return value;
    };

    // Order identifier
    let externalId = generated ? `ROW-${row}` : text("orderId");
    if (!externalId) report("orderId", "missing", "No order identifier.");
    else if (externalId.length > 200) {
      report("orderId", "too_long", "Order identifier is longer than 200 characters.");
      externalId = "";
    }

    // Date
    let placedAt = Number.NaN;
    if (!text("orderDate")) report("orderDate", "missing", "No order date.");
    else {
      const parsed = parseDate(raw("orderDate"), target.timezone, options.dateOrder);
      if (parsed !== null) placedAt = parsed;
      else if (options.dateOrder === null && /^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}/.test(text("orderDate")))
        report("orderDate", "ambiguous_date", "Day and month cannot be told apart. Choose how dates are written.");
      else report("orderDate", "bad_date", "Not a date Flowly can read. Use YYYY-MM-DD, or a date between 2000 and 2100.");
    }

    // Status
    let status: OrderStatus | null = null;
    if (text("status")) {
      status = parseStatus(raw("status"));
      if (!status) report("status", "bad_status", "Unknown status. Use completed, refunded, cancelled or pending.");
    } else if (options.defaultStatus) status = options.defaultStatus;
    else report(has("status") ? "status" : null, "missing", "No status, and no default status was chosen.");

    // Currency
    if (has("currency") && text("currency") && text("currency").toUpperCase() !== target.currency)
      report(
        "currency",
        "bad_currency",
        `This workspace is in ${target.currency}. Amounts in another currency are not converted and not imported.`,
      );

    // Amounts
    const money = (field: Field, label: string): number | null => {
      if (!text(field)) return null;
      const minor = parseAmount(raw(field), target.currency);
      if (minor === null) report(field, "bad_amount", `${label} is not a number.`);
      else if (minor < 0)
        report(field, "negative_amount", `${label} is negative. Refunds go in a refund column or as the status "refunded".`);
      return minor !== null && minor >= 0 ? minor : null;
    };

    let quantity = 1;
    if (text("quantity")) {
      const parsed = parseQuantity(raw("quantity"));
      if (parsed === null) report("quantity", "bad_quantity", "Quantity must be a whole number, 1 or more.");
      else quantity = parsed;
    }
    const amount = money("amount", "Amount");
    const unitPrice = money("unitPrice", "Unit price");
    const discount = money("discount", "Discount") ?? 0;
    const refund = money("refund", "Refund") ?? 0;

    let line: ImportLine | null = null;
    if (amount === null && unitPrice === null) {
      // Only complain about absence if nothing else already explained it.
      if (!text("amount") && !text("unitPrice")) report(has("amount") ? "amount" : "unitPrice", "missing", "No amount.");
    } else {
      let grossMinor: number;
      let discountMinor: number;
      let netMinor: number;
      if (amount !== null) {
        // The amount column is what was charged: it is the net.
        netMinor = amount;
        grossMinor = unitPrice !== null ? Math.max(unitPrice * quantity, netMinor) : netMinor + discount;
        discountMinor = grossMinor - netMinor;
        if (unitPrice !== null && unitPrice * quantity < netMinor)
          report("amount", "conflict", "Amount is more than quantity × unit price; the amount was kept.", "warning");
      } else {
        grossMinor = unitPrice! * quantity;
        discountMinor = Math.min(discount, grossMinor);
        netMinor = grossMinor - discountMinor;
        if (discount > grossMinor) report("discount", "conflict", "Discount is more than quantity × unit price; it was capped.", "warning");
      }
      line = {
        productName: optional("product"),
        category: optional("category"),
        quantity,
        unitPriceMinor: unitPrice ?? Math.round(grossMinor / quantity),
        grossMinor,
        discountMinor,
        netMinor,
      };
    }

    // Customer: an ID, or failing that an email. Neither means nobody, and nobody is invented.
    const customerId = optional("customerId");
    let email = optional("customerEmail");
    if (email && !isEmail(email)) {
      report("customerEmail", "bad_email", "Not an email address; it was left out.", "warning");
      email = null;
    }
    const name = optional("customerName");
    const customer: ImportCustomer | null = customerId
      ? { identityKey: `id:${customerId}`, externalId: customerId, name, email: email?.toLowerCase() ?? null }
      : email
        ? { identityKey: `email:${email.toLowerCase()}`, externalId: null, name, email: email.toLowerCase() }
        : null;

    const channel = optional("channel");

    if (failed || !line || !status || !externalId || Number.isNaN(placedAt)) {
      rejected.add(row);
      return;
    }
    drafts.push({ row, externalId, placedAt, status, channel, customer, line, refundMinor: refund });
  });

  // Rows into orders.
  const byId = new Map<string, ImportOrder>();
  const dropped = new Set<string>();
  const reject = (order: ImportOrder | undefined, row: number, field: Field | null, code: IssueCode, message: string) => {
    issues.push({ row, field, code, severity: "error", message });
    rejected.add(row);
    if (order) {
      for (const other of order.rows) rejected.add(other);
      dropped.add(order.externalId);
    }
  };

  for (const draft of drafts) {
    const found = byId.get(draft.externalId);
    if (!found) {
      byId.set(draft.externalId, {
        externalId: draft.externalId,
        placedAt: draft.placedAt,
        status: draft.status,
        channel: draft.channel,
        customer: draft.customer,
        lines: [draft.line],
        grossMinor: draft.line.grossMinor,
        discountMinor: draft.line.discountMinor,
        netMinor: draft.line.netMinor,
        refundMinor: draft.refundMinor,
        rows: [draft.row],
      });
      continue;
    }
    if (options.interpretation === "order_per_row") {
      reject(
        undefined,
        draft.row,
        "orderId",
        "duplicate_in_file",
        `Order ${draft.externalId} is already on line ${found.rows[0]}. Only the first is imported.`,
      );
      continue;
    }
    // Lines of one order must agree about the order itself. If they do not, the whole order stays out.
    const clash =
      found.placedAt !== draft.placedAt
        ? "date"
        : found.status !== draft.status
          ? "status"
          : (found.customer?.identityKey ?? null) !== (draft.customer?.identityKey ?? null)
            ? "customer"
            : (found.channel ?? null) !== (draft.channel ?? null)
              ? "channel"
              : null;
    if (clash) {
      reject(
        found,
        draft.row,
        "orderId",
        "conflict",
        `Lines of order ${draft.externalId} disagree about its ${clash} (see line ${found.rows[0]}). The order was left out.`,
      );
      continue;
    }
    if (dropped.has(draft.externalId)) {
      rejected.add(draft.row);
      continue;
    }
    found.lines.push(draft.line);
    found.rows.push(draft.row);
    found.grossMinor += draft.line.grossMinor;
    found.discountMinor += draft.line.discountMinor;
    found.netMinor += draft.line.netMinor;
    // A refund written on every line of an order is the order's refund once per line.
    found.refundMinor += draft.refundMinor;
  }

  const orders: ImportOrder[] = [];
  const replacing: string[] = [];
  let skippedExisting = 0;
  for (const order of byId.values()) {
    if (dropped.has(order.externalId)) continue;
    if (order.status === "refunded") order.refundMinor = order.netMinor;
    else if (order.status !== "completed") order.refundMinor = 0;
    else if (order.refundMinor > order.netMinor) {
      reject(order, order.rows[0], "refund", "refund_too_large", `Refund is more than the net amount of order ${order.externalId}.`);
      continue;
    }
    if (existingIds.has(order.externalId)) {
      if (options.duplicates === "skip") {
        skippedExisting += 1;
        continue;
      }
      replacing.push(order.externalId);
    }
    orders.push(order);
  }

  const acceptedRows = orders.reduce((sum, order) => sum + order.rows.length, 0);
  issues.sort((a, b) => a.row - b.row);
  return {
    orders,
    issues,
    rowCount: table.rows.length,
    acceptedRows,
    rejectedRows: rejected.size,
    skippedExisting,
    replacing,
    anonymousOrders: orders.filter((order) => order.customer === null).length,
    generatedIds: generated,
  };
}
