import type { SupabaseClient } from "@supabase/supabase-js";
import { minorToDecimalString } from "@/lib/money";
import type { FileKind } from "./table";
import { LIMITS, type ImportOptions, type ImportOrder, type Issue, type Mapping, type Validation } from "./types";

// Storing a confirmed import. The browser sends the validated orders straight
// to the database as the signed-in user, in chunks; the database checks every
// one again. If anything fails part-way, what was written is removed, so an
// import either happens or does not.

export type PersistInput = {
  workspaceId: string;
  currency: string;
  filename: string;
  kind: FileKind;
  headers: string[];
  mapping: Mapping;
  options: ImportOptions;
  validation: Validation;
};

export type PersistResult = { inserted: number; skipped: number; replaced: number };

export class PersistError extends Error {
  constructor(
    public code: "limit" | "failed" | "partial",
    message: string,
  ) {
    super(message);
  }
}

/** An order in the shape the database function takes: amounts as exact decimal text. */
export function toPayload(order: ImportOrder, currency: string) {
  const amount = (minor: number) => minorToDecimalString(minor, currency);
  return {
    external_id: order.externalId,
    placed_at: new Date(order.placedAt).toISOString(),
    status: order.status,
    channel: order.channel,
    gross: amount(order.grossMinor),
    discount: amount(order.discountMinor),
    net: amount(order.netMinor),
    refund: amount(order.refundMinor),
    customer: order.customer
      ? {
          identity_key: order.customer.identityKey,
          external_id: order.customer.externalId,
          name: order.customer.name,
          email: order.customer.email,
        }
      : null,
    lines: order.lines.map((line) => ({
      product: line.productName,
      category: line.category,
      quantity: line.quantity,
      unit_price: amount(line.unitPriceMinor),
      gross: amount(line.grossMinor),
      discount: amount(line.discountMinor),
      net: amount(line.netMinor),
    })),
  };
}

/** What is kept of the validation, to show later under "Previous imports". Bounded, so a bad file cannot fill the database. */
export function validationLog(issues: readonly Issue[], validation: Validation) {
  return {
    issues: issues.slice(0, 200).map(({ row, field, code, severity, message }) => ({ row, field, code, severity, message })),
    total: issues.length,
    skippedExisting: validation.skippedExisting,
    replaced: validation.replacing.length,
    anonymousOrders: validation.anonymousOrders,
    generatedIds: validation.generatedIds,
  };
}

export async function persistImport(
  supabase: SupabaseClient,
  input: PersistInput,
  onProgress: (done: number, total: number) => void,
): Promise<PersistResult> {
  const { validation, options, mapping, headers } = input;
  const { orders } = validation;

  const batch = await supabase
    .from("import_batches")
    .insert({
      workspace_id: input.workspaceId,
      filename: input.filename.slice(0, 255),
      file_type: input.kind,
      interpretation: options.interpretation,
      row_count: validation.rowCount,
      // Which heading was read as what, so an import can be understood later.
      mapping_json: Object.fromEntries(Object.entries(mapping).map(([field, column]) => [field, headers[column as number] ?? null])),
    })
    .select("id")
    .single();
  if (batch.error || !batch.data) throw new PersistError("failed", batch.error?.message ?? "no batch");
  const batchId = batch.data.id as string;

  const result: PersistResult = { inserted: 0, skipped: 0, replaced: 0 };
  try {
    for (let start = 0; start < orders.length; start += LIMITS.chunk) {
      const chunk = orders.slice(start, start + LIMITS.chunk).map((order) => toPayload(order, input.currency));
      const { data, error } = await supabase.rpc("import_orders", {
        p_batch: batchId,
        p_orders: chunk,
        p_replace: options.duplicates === "replace",
      });
      if (error) throw new PersistError(error.code === "54000" ? "limit" : "failed", error.message);
      result.inserted += data.inserted;
      result.skipped += data.skipped;
      result.replaced += data.replaced;
      onProgress(Math.min(start + LIMITS.chunk, orders.length), orders.length);
    }
    const finished = await supabase.rpc("finish_import", {
      p_batch: batchId,
      p_rejected: validation.rejectedRows,
      p_warnings: validationLog(validation.issues, validation),
    });
    if (finished.error) throw new PersistError("failed", finished.error.message);
    return result;
  } catch (error) {
    // Undo: remove the batch and everything it brought in.
    const undone = await supabase.rpc("delete_import", { p_batch: batchId });
    if (undone.error) throw new PersistError("partial", undone.error.message);
    throw error instanceof PersistError ? error : new PersistError("failed", String(error));
  }
}
