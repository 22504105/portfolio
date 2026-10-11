import type { OrderStatus } from "@/lib/domain/types";

// The import pipeline: a file becomes a Table of raw cells, a Mapping says
// which column is what, validation turns rows into orders or into issues, and
// only the orders are ever sent anywhere. A file is untrusted from start to
// finish: nothing in it is run, and every value is checked before it is used.

/** A raw cell. Spreadsheets give numbers, booleans and dates; CSV gives only text. */
export type Cell = string | number | boolean | Date | null;

export type Table = {
  headers: string[];
  rows: Cell[][];
  /** The line of the file that rows[0] came from, counting from 1, for messages a person can follow. */
  firstRowNumber: number;
  /** Things worth telling the user about how the file was read. */
  notes: string[];
};

export const LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  rows: 10_000,
  columns: 100,
  cellLength: 500,
  /** What a spreadsheet may unpack to. A small file that unpacks to much more is refused unread. */
  unpackedBytes: 60 * 1024 * 1024,
  /** Orders sent to the database in one request. */
  chunk: 400,
} as const;

export const FIELDS = [
  "orderId",
  "orderDate",
  "amount",
  "quantity",
  "unitPrice",
  "discount",
  "refund",
  "status",
  "customerId",
  "customerName",
  "customerEmail",
  "product",
  "category",
  "channel",
  "currency",
] as const;
export type Field = (typeof FIELDS)[number];

/** Which column (by position) holds each field. A field that is absent is not mapped. */
export type Mapping = Partial<Record<Field, number>>;

export type Interpretation = "order_per_row" | "line_per_row";
export type DateOrder = "dmy" | "mdy";

export type ImportOptions = {
  /** What one row of the file is: a whole order, or one line of an order. */
  interpretation: Interpretation;
  /** How to read 03/04/2026. Null until the file or the user settles it. */
  dateOrder: DateOrder | null;
  /** The status for rows that have none. Null means such rows are refused: a status is never assumed silently. */
  defaultStatus: OrderStatus | null;
  /** Number the orders by their row when the file has no order identifier. Only for one order per row. */
  generateIds: boolean;
  /** What to do with an order number the workspace already has. */
  duplicates: "skip" | "replace";
};

export type IssueCode =
  | "missing"
  | "bad_date"
  | "ambiguous_date"
  | "bad_amount"
  | "negative_amount"
  | "bad_quantity"
  | "bad_status"
  | "bad_currency"
  | "bad_email"
  | "too_long"
  | "duplicate_in_file"
  | "conflict"
  | "refund_too_large";

export type Issue = {
  /** The line of the file. */
  row: number;
  field: Field | null;
  code: IssueCode;
  /** An error keeps the row out; a warning lets it in and says what was done. */
  severity: "error" | "warning";
  message: string;
  value?: string;
};

export type ImportCustomer = {
  /** "id:<customer id>" or "email:<lower-cased email>": what makes two rows the same person. */
  identityKey: string;
  externalId: string | null;
  name: string | null;
  email: string | null;
};

export type ImportLine = {
  productName: string | null;
  category: string | null;
  quantity: number;
  unitPriceMinor: number;
  grossMinor: number;
  discountMinor: number;
  netMinor: number;
};

export type ImportOrder = {
  externalId: string;
  placedAt: number;
  status: OrderStatus;
  channel: string | null;
  customer: ImportCustomer | null;
  lines: ImportLine[];
  grossMinor: number;
  discountMinor: number;
  netMinor: number;
  refundMinor: number;
  /** The lines of the file this order was made from. */
  rows: number[];
};

export type Validation = {
  /** Orders that are ready to import, after the duplicate policy has been applied. */
  orders: ImportOrder[];
  issues: Issue[];
  rowCount: number;
  /** Rows that became part of an order to import. */
  acceptedRows: number;
  /** Rows kept out by an error. */
  rejectedRows: number;
  /** Orders left out because the workspace already has them (policy "skip"). */
  skippedExisting: number;
  /** Orders that will take the place of ones the workspace already has (policy "replace"). */
  replacing: string[];
  /** Orders with no customer: they will count as orders and revenue, not as customers. */
  anonymousOrders: number;
  /** Identifiers were made up from row numbers. */
  generatedIds: boolean;
};
