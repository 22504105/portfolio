"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ImportBatch } from "@/lib/data/workspace";
import { fill, type Messages } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type LogEntry = { row: number; message: string; severity: string };

/** What was kept of a batch's validation, read defensively: it is data from the database, not a promise. */
function logOf(batch: ImportBatch): { entries: LogEntry[]; total: number } {
  const log = batch.warnings as { issues?: unknown; total?: unknown } | null;
  const entries = Array.isArray(log?.issues)
    ? log.issues
        .filter((item): item is LogEntry => !!item && typeof item === "object" && typeof (item as LogEntry).message === "string")
        .slice(0, 200)
    : [];
  return { entries, total: typeof log?.total === "number" ? log.total : entries.length };
}

const whole = new Intl.NumberFormat("en-US");

export function BatchList({ batches, timezone, labels }: { batches: ImportBatch[]; timezone: string; labels: Messages["imports"] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const remove = async (batch: ImportBatch) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    // The database removes the batch, its orders and their lines, and the customers left with no order.
    const { error } = await supabaseBrowser().rpc("delete_import", { p_batch: batch.id });
    // "Not found" means it is already gone (a second press, or another tab): that is what was asked for.
    const failed = error !== null && error.code !== "P0002";
    setBusy(false);
    setConfirming(null);
    setNotice(failed ? { tone: "error", text: labels.failed } : { tone: "ok", text: labels.deleted });
    if (!failed) router.refresh();
  };

  if (batches.length === 0) return <p className="card text-ink-muted px-5 py-6">{labels.none}</p>;

  const when = new Intl.DateTimeFormat("en-US", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      {notice && (
        <p
          role="status"
          className={cn(
            "rounded-input mb-3 border px-3.5 py-2.5",
            notice.tone === "ok" ? "border-positive/30 bg-positive/8 text-positive" : "border-negative/30 bg-negative/8 text-negative",
          )}
        >
          {notice.text}
        </p>
      )}
      <ul className="card divide-line divide-y">
        {batches.map((batch) => {
          const { entries, total } = logOf(batch);
          return (
            <li key={batch.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{batch.filename}</p>
                  <p className="type-meta text-ink-muted mt-0.5 tabular-nums">
                    {when.format(new Date(batch.importedAt))} · {labels.states[batch.status]}
                  </p>
                </div>
                <dl className="flex gap-6 tabular-nums">
                  {(
                    [
                      [labels.rows, batch.rowCount],
                      [labels.accepted, batch.acceptedCount],
                      [labels.rejected, batch.rejectedCount],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="type-meta text-ink-muted">{label}</dt>
                      <dd className="font-medium">{whole.format(value)}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  onClick={() => setConfirming(confirming === batch.id ? null : batch.id)}
                  aria-expanded={confirming === batch.id}
                  className="rounded-input border-input bg-surface text-negative hover:bg-negative/8 inline-flex h-10 items-center gap-2 border px-3.5 font-medium transition-colors"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {labels.delete}
                </button>
              </div>

              {confirming === batch.id && (
                <div
                  role="alertdialog"
                  aria-labelledby={`delete-${batch.id}`}
                  className="rounded-input border-negative/30 bg-negative/8 mt-4 border p-4"
                >
                  <p id={`delete-${batch.id}`} className="font-medium">
                    {labels.deleteTitle}
                  </p>
                  <p className="text-ink-muted mt-1">{fill(labels.deleteBody, { count: whole.format(batch.acceptedCount) })}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => remove(batch)}
                      aria-disabled={busy || undefined}
                      className="rounded-input bg-negative inline-flex h-10 items-center px-4 font-medium text-white aria-disabled:opacity-60"
                    >
                      {busy ? labels.deleting : labels.deleteConfirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="rounded-input border-input bg-surface inline-flex h-10 items-center border px-4 font-medium"
                    >
                      {labels.cancel}
                    </button>
                  </div>
                </div>
              )}

              <details className="mt-3">
                <summary className="text-brand-hover inline-flex min-h-8 cursor-pointer items-center underline-offset-4 hover:underline">
                  {labels.log} ({whole.format(total)})
                </summary>
                {entries.length === 0 ? (
                  <p className="text-ink-muted mt-2">{labels.logEmpty}</p>
                ) : (
                  <ul className="border-line bg-surface-2 mt-2 max-h-56 overflow-auto rounded-[10px] border px-4 py-2 text-[0.8125rem]">
                    {entries.map((entry, index) => (
                      <li key={index} className="py-1">
                        <span className="text-ink-muted tabular-nums">#{entry.row}</span> {entry.message}
                      </li>
                    ))}
                    {total > entries.length && (
                      <li className="text-ink-muted py-1">{fill(labels.logMore, { count: whole.format(total - entries.length) })}</li>
                    )}
                  </ul>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
