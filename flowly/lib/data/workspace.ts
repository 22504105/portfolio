import "server-only";
import { cache } from "react";
import type { Customer, Dataset, Order, OrderLine, OrderStatus, Workspace } from "@/lib/domain/types";
import { toMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dayKey } from "@/lib/time";
import type { Calendar } from "@/lib/view/state";
import type { WorkspaceContext } from "@/lib/workspace";

// A signed-in user's workspace, read from the database under row level
// security and turned into the same Dataset the demo produces. From here on
// the pages cannot tell the two apart.

const PAGE = 1000;

export type WorkspaceRow = Workspace & { createdAt: string };

export type ImportBatch = {
  id: string;
  filename: string;
  fileType: "csv" | "xlsx";
  interpretation: string;
  rowCount: number;
  acceptedCount: number;
  rejectedCount: number;
  status: "importing" | "completed" | "failed";
  importedAt: string;
  warnings: unknown;
};

/** The signed-in user's workspace, or null if they have not made one yet. Once per request. */
export const loadWorkspace = cache(async (): Promise<WorkspaceRow | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("workspaces").select("id, name, currency_code, timezone, created_at").maybeSingle();
  if (error) throw new Error(`Could not load the workspace: ${error.message}`);
  return data ? { id: data.id, name: data.name, currency: data.currency_code, timezone: data.timezone, createdAt: data.created_at } : null;
});

type LineRow = {
  position: number;
  product_name: string | null;
  category: string | null;
  quantity: number;
  unit_price: string | number;
  gross_amount: string | number;
  discount_amount: string | number;
  net_amount: string | number;
};
type OrderRow = {
  id: string;
  external_order_id: string;
  order_date: string;
  customer_id: string | null;
  channel: string | null;
  status: OrderStatus;
  gross_amount: string | number;
  discount_amount: string | number;
  net_amount: string | number;
  refund_amount: string | number;
  order_lines: LineRow[];
};

/** Reads a table page by page: the API returns at most a thousand rows at a time. */
async function all<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load the workspace data: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Everything the workspace holds, as a Dataset. Once per request, however many components ask. */
export const loadDataset = cache(async (): Promise<Dataset | null> => {
  const workspace = await loadWorkspace();
  const supabase = await createSupabaseServerClient();
  if (!workspace || !supabase) return null;

  // numeric arrives as text; amounts become whole minor units, as everywhere else.
  const minor = (value: string | number) => toMinor(value, workspace.currency) ?? 0;

  const [orderRows, customerRows, batches] = await Promise.all([
    all<OrderRow>((from, to) =>
      supabase
        .from("orders")
        .select(
          "id, external_order_id, order_date, customer_id, channel, status, gross_amount, discount_amount, net_amount, refund_amount, order_lines(position, product_name, category, quantity, unit_price, gross_amount, discount_amount, net_amount)",
        )
        .order("order_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    all<{ id: string; external_customer_id: string | null; name: string | null; email: string | null }>((from, to) =>
      supabase.from("customers").select("id, external_customer_id, name, email").order("id", { ascending: true }).range(from, to),
    ),
    supabase.from("import_batches").select("id", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  const orders: Order[] = orderRows.map((row) => ({
    id: row.id,
    externalId: row.external_order_id,
    placedAt: Date.parse(row.order_date),
    customerId: row.customer_id,
    channel: row.channel,
    status: row.status,
    lines: [...row.order_lines]
      .sort((a, b) => a.position - b.position)
      .map((line): OrderLine => ({
        productName: line.product_name,
        category: line.category,
        quantity: line.quantity,
        unitPriceMinor: minor(line.unit_price),
        grossMinor: minor(line.gross_amount),
        discountMinor: minor(line.discount_amount),
        netMinor: minor(line.net_amount),
      })),
    grossMinor: minor(row.gross_amount),
    discountMinor: minor(row.discount_amount),
    netMinor: minor(row.net_amount),
    refundMinor: minor(row.refund_amount),
  }));

  const customers: Customer[] = customerRows.map((row) => ({
    id: row.id,
    externalId: row.external_customer_id,
    name: row.name,
    email: row.email,
  }));

  return {
    workspace: { id: workspace.id, name: workspace.name, currency: workspace.currency, timezone: workspace.timezone },
    orders,
    customers,
    provenance: { kind: "imports", batches: batches.count ?? 0 },
  };
});

/** The days a workspace has orders for. With none yet, today. */
export function calendarOf(dataset: Dataset): Calendar {
  const { timezone } = dataset.workspace;
  if (dataset.orders.length === 0) {
    const today = dayKey(Date.now(), timezone);
    return { firstDay: today, lastDay: today };
  }
  let first = Infinity;
  let last = -Infinity;
  for (const order of dataset.orders) {
    if (order.placedAt < first) first = order.placedAt;
    if (order.placedAt > last) last = order.placedAt;
  }
  return { firstDay: dayKey(first, timezone), lastDay: dayKey(last, timezone) };
}

/** What the workspace pages need, or null when there is no workspace to show. */
export async function appWorkspace(): Promise<WorkspaceContext | null> {
  const dataset = await loadDataset();
  return dataset ? { root: "/app", dataset, calendar: calendarOf(dataset) } : null;
}

export const loadBatches = cache(async (): Promise<ImportBatch[]> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, filename, file_type, interpretation, row_count, accepted_count, rejected_count, status, imported_at, warnings_json")
    .order("imported_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load the imports: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    filename: row.filename,
    fileType: row.file_type,
    interpretation: row.interpretation,
    rowCount: row.row_count,
    acceptedCount: row.accepted_count,
    rejectedCount: row.rejected_count,
    status: row.status,
    importedAt: row.imported_at,
    warnings: row.warnings_json,
  }));
});
