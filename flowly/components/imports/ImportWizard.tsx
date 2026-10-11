"use client";

import { AlertTriangle, Check, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import type { OrderStatus } from "@/lib/domain/types";
import { ORDER_STATUSES } from "@/lib/domain/types";
import { toCsv } from "@/lib/export/csv";
import { fill, type Messages } from "@/lib/i18n";
import { dateOrderOf, missingRequired, sampleValues, suggestMapping, suggestOptions } from "@/lib/import/mapping";
import { PersistError, persistImport, type PersistResult } from "@/lib/import/persist";
import { readImportFile, type ReadResult } from "@/lib/import/read";
import { ImportFileError } from "@/lib/import/table";
import { FIELDS, type Field, type ImportOptions, type Mapping } from "@/lib/import/types";
import { validate } from "@/lib/import/validate";
import { cellText } from "@/lib/import/values";
import { formatMoney } from "@/lib/money";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { formatInstant } from "@/lib/time";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "validate" | "confirm" | "done";
const STEPS = ["upload", "map", "validate", "confirm"] as const;
const REQUIRED: readonly Field[] = ["orderId", "orderDate", "amount"];
const PREVIEW_ROWS = 20;
const ISSUES_SHOWN = 50;

type ImportWizardProps = {
  messages: Messages;
  workspace: { id: string; currency: string; timezone: string };
  /** Order numbers the workspace already has. */
  existingIds: string[];
  /** In the demo nothing is stored: the last step explains that and offers sign-up. */
  demo: boolean;
  overviewHref: string;
};

const button = "inline-flex h-11 items-center justify-center gap-2 rounded-input px-5 font-medium transition-colors";
const primary = cn(button, "bg-brand text-white hover:bg-brand-hover aria-disabled:opacity-50");
const secondary = cn(button, "border border-input bg-surface hover:bg-surface-2");
const select = "h-10 w-full rounded-input border border-input bg-surface px-3 text-ink";
const whole = new Intl.NumberFormat("en-US");

export function ImportWizard({ messages, workspace, existingIds, demo, overviewHref }: ImportWizardProps) {
  const t = messages.importer;
  const router = useRouter();
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<ReadResult | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [options, setOptions] = useState<ImportOptions | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<PersistResult | null>(null);
  const [failure, setFailure] = useState<"limit" | "failed" | "partial" | null>(null);

  // A new step starts at its top: the button that led here was at the bottom of the last one.
  // Focus moves with it, so a keyboard or screen-reader user is not left behind on a button that is gone.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    frame.current?.scrollIntoView({ block: "start" });
    frame.current?.focus({ preventScroll: true });
  }, [step]);

  const existing = useMemo(() => new Set(existingIds), [existingIds]);
  const table = file?.table ?? null;

  const detected = useMemo(
    () => (table && mapping.orderDate !== undefined ? dateOrderOf(table, mapping.orderDate) : "none"),
    [table, mapping.orderDate],
  );
  const missing = options ? missingRequired(mapping, options) : REQUIRED;
  const needsDateOrder = (detected === "ambiguous" || detected === "conflict") && options?.dateOrder === null;
  const canValidate = !!options && missing.length === 0 && !needsDateOrder;

  const validation = useMemo(
    () =>
      table && options && canValidate && step !== "upload" && step !== "map"
        ? validate(table, mapping, options, workspace, existing)
        : null,
    [table, options, mapping, workspace, existing, canValidate, step],
  );
  const overlap = useMemo(() => {
    if (!table || mapping.orderId === undefined) return 0;
    const ids = new Set(table.rows.map((row) => cellText(row[mapping.orderId!])));
    let count = 0;
    for (const id of ids) if (existing.has(id)) count++;
    return count;
  }, [table, mapping.orderId, existing]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setMapping({});
    setOptions(null);
    setFileError(null);
    setProgress(null);
    setResult(null);
    setFailure(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const open = async (chosen: File | undefined) => {
    if (!chosen) return;
    setReading(true);
    setFileError(null);
    try {
      const read = await readImportFile(chosen);
      const suggested = suggestMapping(read.table.headers);
      setFile(read);
      setMapping(suggested);
      setOptions(suggestOptions(read.table, suggested));
      setStep("map");
    } catch (error) {
      setFileError(error instanceof ImportFileError ? error.message : "The file could not be read.");
    } finally {
      setReading(false);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void open(event.dataTransfer.files[0]);
  };

  const mapField = (field: Field, value: string) => {
    const next = { ...mapping };
    if (value === "") delete next[field];
    else {
      const column = Number(value);
      // A column is one thing only: taking it for this field releases it from any other.
      for (const other of FIELDS) if (next[other] === column) delete next[other];
      next[field] = column;
    }
    setMapping(next);
    // The date order follows the newly mapped column when the file settles it.
    if (field === "orderDate" && table && options) {
      const found = next.orderDate === undefined ? "none" : dateOrderOf(table, next.orderDate);
      setOptions({ ...options, dateOrder: found === "dmy" || found === "mdy" ? found : null });
    }
  };

  const store = async () => {
    if (!file || !options || !validation || progress) return;
    setFailure(null);
    setProgress({ done: 0, total: validation.orders.length });
    try {
      const stored = await persistImport(
        supabaseBrowser(),
        {
          workspaceId: workspace.id,
          currency: workspace.currency,
          filename: file.name,
          kind: file.kind,
          headers: file.table.headers,
          mapping,
          options,
          validation,
        },
        (done, total) => setProgress({ done, total }),
      );
      setResult(stored);
      setStep("done");
      router.refresh();
    } catch (error) {
      setFailure(error instanceof PersistError ? error.code : "failed");
    } finally {
      setProgress(null);
    }
  };

  const downloadIssues = () => {
    if (!validation) return;
    const csv = toCsv(
      ["Line", "Column", "Severity", "Problem", "Value"],
      validation.issues.map((issue) => [
        issue.row,
        issue.field ? t.fields[issue.field] : "",
        issue.severity,
        issue.message,
        issue.value ?? "",
      ]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flowly-import-problems.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const current = step === "done" ? 4 : STEPS.indexOf(step);

  return (
    <div ref={frame} tabIndex={-1} className="card min-w-0 scroll-mt-36 p-5 outline-none lg:scroll-mt-24 lg:p-7">
      {/* Progress: four numbered steps, the current one named for screen readers. */}
      <ol aria-label={fill(t.stepOf, { step: Math.min(current + 1, 4) })} className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((name, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={name} aria-current={active ? "step" : undefined} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.8125rem] font-semibold tabular-nums",
                  done && "border-brand bg-brand text-white",
                  active && "border-brand bg-brand-tint text-brand-hover",
                  !done && !active && "border-input bg-surface text-ink-muted",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-4" /> : index + 1}
              </span>
              <span className={cn("truncate font-medium max-sm:hidden", !active && !done && "text-ink-muted")}>{t.steps[name]}</span>
              {index < STEPS.length - 1 && <span aria-hidden="true" className={cn("h-px min-w-3 flex-1", done ? "bg-brand" : "bg-line")} />}
            </li>
          );
        })}
      </ol>

      <div className="mt-7">
        {step === "upload" && (
          <>
            <label
              htmlFor={inputId}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "rounded-card flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-brand bg-brand-tint" : "border-input hover:border-brand/60 hover:bg-surface-2",
              )}
            >
              <span className="bg-brand-tint text-brand-hover flex size-12 items-center justify-center rounded-full">
                <Upload aria-hidden="true" className="size-5" />
              </span>
              <span className="type-card text-[1.0625rem]">{reading ? t.reading : t.drop}</span>
              {!reading && (
                <span className="text-ink-muted">
                  {t.or} <span className="text-brand-hover font-medium underline underline-offset-4">{t.choose}</span>
                </span>
              )}
              <span className="type-meta text-ink-muted max-w-md">{messages.imports.limits}</span>
            </label>
            <input
              ref={fileInput}
              id={inputId}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => void open(event.target.files?.[0])}
            />
            {fileError && (
              <p
                role="alert"
                className="rounded-input border-negative/30 bg-negative/8 text-negative mt-4 flex items-start gap-2 border px-3.5 py-3"
              >
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {fileError}
              </p>
            )}
          </>
        )}

        {step === "map" && table && options && file && (
          <div className="flex flex-col gap-7">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
              <FileSpreadsheet aria-hidden="true" className="text-ink-muted size-4" />
              {fill(t.file, { name: file.name, rows: whole.format(table.rows.length) })}
            </p>

            <section aria-labelledby="notes-title">
              <h3 id="notes-title" className="type-label text-ink-muted">
                {t.notes}
              </h3>
              <ul className="text-ink-muted mt-2 list-disc pl-5">
                {table.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="preview-title">
              <h3 id="preview-title" className="type-label text-ink-muted">
                {fill(t.preview, { count: Math.min(PREVIEW_ROWS, table.rows.length) })}
              </h3>
              <div
                role="region"
                aria-labelledby="preview-title"
                tabIndex={0}
                className="border-line mt-2 max-h-72 overflow-auto rounded-[10px] border"
              >
                <table className="w-full border-collapse text-left text-[0.8125rem]">
                  <thead className="bg-surface-2 sticky top-0">
                    <tr>
                      {table.headers.map((header, index) => (
                        <th key={index} scope="col" className="border-line border-b px-3 py-2 font-medium whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y">
                    {table.rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                      <tr key={index}>
                        {table.headers.map((_, column) => (
                          // Cell text is rendered as text. Whatever a file contains, it is never markup and never run.
                          <td key={column} className="text-ink-muted max-w-56 truncate px-3 py-1.5 whitespace-nowrap">
                            {cellText(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <fieldset>
              <legend className="type-card">{t.interpretation}</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["order_per_row", t.orderPerRow, t.orderPerRowHint],
                    ["line_per_row", t.linePerRow, t.linePerRowHint],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={cn(
                      "rounded-input flex cursor-pointer gap-3 border p-3.5 transition-colors",
                      options.interpretation === value ? "border-brand bg-brand-tint" : "border-input hover:bg-surface-2",
                    )}
                  >
                    <input
                      type="radio"
                      name="interpretation"
                      value={value}
                      checked={options.interpretation === value}
                      onChange={() =>
                        setOptions({ ...options, interpretation: value, generateIds: value === "order_per_row" && options.generateIds })
                      }
                      className="mt-1 accent-(--accent-base)"
                    />
                    <span>
                      <span className="block font-medium">{label}</span>
                      <span className="type-meta text-ink-muted">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <section aria-labelledby="columns-title">
              <h3 id="columns-title" className="type-card">
                {t.columns}
              </h3>
              <p className="text-ink-muted mt-1">{t.columnsHint}</p>
              <ul className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-2">
                {FIELDS.map((field) => {
                  const column = mapping[field];
                  const samples = column === undefined ? [] : sampleValues(table, column);
                  const required = REQUIRED.includes(field);
                  const id = `${inputId}-${field}`;
                  return (
                    <li key={field}>
                      <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor={id} className="font-medium">
                          {t.fields[field]}
                        </label>
                        {required && <span className="type-meta text-ink-muted">{t.required}</span>}
                      </div>
                      <select
                        id={id}
                        value={column ?? ""}
                        onChange={(event) => mapField(field, event.target.value)}
                        aria-describedby={`${id}-help`}
                        className={cn(select, "mt-1.5", column !== undefined && "border-brand/50")}
                      >
                        <option value="">{t.notMapped}</option>
                        {table.headers.map((header, index) => (
                          <option key={index} value={index}>
                            {header}
                          </option>
                        ))}
                      </select>
                      <p id={`${id}-help`} className="type-meta text-ink-muted mt-1.5">
                        {samples.length > 0 ? (
                          <span className="text-ink">{fill(t.examples, { values: samples.join(" · ") })}</span>
                        ) : (
                          t.fieldHelp[field]
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {detected !== "none" && (
                <div>
                  <label htmlFor={`${inputId}-date-order`} className="font-medium">
                    {t.dateOrder}
                  </label>
                  <select
                    id={`${inputId}-date-order`}
                    value={options.dateOrder ?? ""}
                    onChange={(event) =>
                      setOptions({ ...options, dateOrder: event.target.value === "" ? null : (event.target.value as "dmy" | "mdy") })
                    }
                    className={cn(select, "mt-1.5", needsDateOrder && "border-warning")}
                  >
                    <option value="">{t.chooseOne}</option>
                    <option value="dmy">{t.dmy}</option>
                    <option value="mdy">{t.mdy}</option>
                  </select>
                  <p className="type-meta text-ink-muted mt-1.5">
                    {detected === "conflict"
                      ? t.dateOrderConflict
                      : detected === "ambiguous"
                        ? ""
                        : fill(t.dateOrderDetected, { order: detected === "dmy" ? t.dmy : t.mdy })}
                  </p>
                </div>
              )}

              <div>
                <label htmlFor={`${inputId}-default-status`} className="font-medium">
                  {t.defaultStatus}
                </label>
                <select
                  id={`${inputId}-default-status`}
                  value={options.defaultStatus ?? ""}
                  onChange={(event) =>
                    setOptions({ ...options, defaultStatus: event.target.value === "" ? null : (event.target.value as OrderStatus) })
                  }
                  className={cn(select, "mt-1.5")}
                >
                  <option value="">{t.defaultStatusNone}</option>
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {fill(t.defaultStatusAs, { status: messages.status[status].toLowerCase() })}
                    </option>
                  ))}
                </select>
              </div>

              {mapping.orderId === undefined && options.interpretation === "order_per_row" && (
                <label className="flex cursor-pointer gap-3 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={options.generateIds}
                    onChange={(event) => setOptions({ ...options, generateIds: event.target.checked })}
                    className="mt-1 size-4 accent-(--accent-base)"
                  />
                  <span>
                    <span className="block font-medium">{t.generateIds}</span>
                    <span className="type-meta text-ink-muted">{t.generateIdsHint}</span>
                  </span>
                </label>
              )}
            </section>

            {(missing.length > 0 || needsDateOrder) && (
              <p role="status" className="rounded-input border-warning/35 bg-warning/8 text-warning border px-3.5 py-2.5">
                {fill(t.stillNeeded, {
                  fields: [...missing.map((field) => t.fields[field]), ...(needsDateOrder ? [t.dateOrder] : [])].join(", "),
                })}
              </p>
            )}

            <div className="flex flex-wrap justify-between gap-3">
              <button type="button" onClick={reset} className={secondary}>
                {t.restart}
              </button>
              <button
                type="button"
                aria-disabled={!canValidate || undefined}
                onClick={() => canValidate && setStep("validate")}
                className={primary}
              >
                {t.next}
              </button>
            </div>
          </div>
        )}

        {(step === "validate" || step === "confirm") && validation && options && file && (
          <div className="flex flex-col gap-7">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(step === "validate"
                ? [
                    [t.summary.rows, whole.format(validation.rowCount)],
                    [t.summary.accepted, whole.format(validation.acceptedRows)],
                    [t.summary.rejected, whole.format(validation.rejectedRows)],
                    [t.summary.orders, whole.format(validation.orders.length)],
                  ]
                : [
                    [t.summary.orders, whole.format(validation.orders.length)],
                    [
                      t.summary.revenue,
                      formatMoney(
                        validation.orders
                          .filter((order) => order.status === "completed")
                          .reduce((sum, order) => sum + order.netMinor - order.refundMinor, 0),
                        workspace.currency,
                      ),
                    ],
                    [
                      t.summary.span,
                      validation.orders.length === 0
                        ? "–"
                        : `${formatInstant(Math.min(...validation.orders.map((order) => order.placedAt)), workspace.timezone)} – ${formatInstant(Math.max(...validation.orders.map((order) => order.placedAt)), workspace.timezone)}`,
                    ],
                    [t.summary.rejected, whole.format(validation.rejectedRows)],
                  ]
              ).map(([label, value]) => (
                <div key={label} className="rounded-input border-line bg-surface-2 border p-4">
                  <dt className="type-meta text-ink-muted">{label}</dt>
                  <dd className="mt-1 text-[1.25rem] font-semibold tracking-[-0.02em] tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <ul className="text-ink-muted flex flex-col gap-1.5">
              {validation.anonymousOrders > 0 && (
                <li>
                  {t.summary.anonymous}:{" "}
                  <span className="text-ink font-medium tabular-nums">{whole.format(validation.anonymousOrders)}</span>. {t.anonymousNote}
                </li>
              )}
              {validation.skippedExisting > 0 && (
                <li>
                  {t.summary.skipped}: <span className="text-ink font-medium tabular-nums">{whole.format(validation.skippedExisting)}</span>
                </li>
              )}
              {validation.replacing.length > 0 && (
                <li>
                  {t.summary.replacing}:{" "}
                  <span className="text-ink font-medium tabular-nums">{whole.format(validation.replacing.length)}</span>
                </li>
              )}
              {validation.generatedIds && <li>{t.generatedNote}</li>}
            </ul>

            {step === "validate" && overlap > 0 && (
              <fieldset>
                <legend className="type-card">{t.duplicates}</legend>
                <p className="text-ink-muted mt-1">{fill(t.duplicatesFound, { count: whole.format(overlap) })}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["skip", t.skip, t.skipHint],
                      ["replace", t.replace, t.replaceHint],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label
                      key={value}
                      className={cn(
                        "rounded-input flex cursor-pointer gap-3 border p-3.5 transition-colors",
                        options.duplicates === value ? "border-brand bg-brand-tint" : "border-input hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="radio"
                        name="duplicates"
                        value={value}
                        checked={options.duplicates === value}
                        onChange={() => setOptions({ ...options, duplicates: value })}
                        className="mt-1 accent-(--accent-base)"
                      />
                      <span>
                        <span className="block font-medium">{label}</span>
                        <span className="type-meta text-ink-muted">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {step === "validate" && (
              <section aria-labelledby="issues-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 id="issues-title" className="type-card">
                    {t.issues}
                    <span className="text-ink-muted ml-2 font-normal tabular-nums">{whole.format(validation.issues.length)}</span>
                  </h3>
                  {validation.issues.length > 0 && (
                    <button type="button" onClick={downloadIssues} className={cn(secondary, "h-10 px-3.5")}>
                      <Download aria-hidden="true" className="size-4" />
                      {t.downloadIssues}
                    </button>
                  )}
                </div>
                {validation.issues.length === 0 ? (
                  <p className="text-positive mt-3 flex items-center gap-2">
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    {t.noIssues}
                  </p>
                ) : (
                  <>
                    <div
                      role="region"
                      aria-labelledby="issues-title"
                      tabIndex={0}
                      className="border-line mt-3 max-h-80 overflow-auto rounded-[10px] border"
                    >
                      <table className="w-full border-collapse text-left">
                        <thead className="bg-surface-2 sticky top-0">
                          <tr>
                            {[t.line, t.field, t.problem, t.value].map((heading) => (
                              <th
                                key={heading}
                                scope="col"
                                className="border-line text-ink-muted border-b px-3 py-2 font-medium whitespace-nowrap"
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-line divide-y">
                          {validation.issues.slice(0, ISSUES_SHOWN).map((issue, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2 align-top tabular-nums">{issue.row}</td>
                              <td className="px-3 py-2 align-top whitespace-nowrap">{issue.field ? t.fields[issue.field] : "–"}</td>
                              <td className="px-3 py-2 align-top">
                                {issue.severity === "warning" && <span className="text-warning mr-1.5 font-medium">{t.warning}:</span>}
                                {issue.message}
                              </td>
                              <td className="text-ink-muted max-w-48 truncate px-3 py-2 align-top">{issue.value ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {validation.issues.length > ISSUES_SHOWN && (
                      <p className="type-meta text-ink-muted mt-2">
                        {fill(t.issuesShown, { shown: ISSUES_SHOWN, total: whole.format(validation.issues.length) })}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            {step === "validate" && validation.orders.length === 0 && (
              <p role="alert" className="rounded-input border-negative/30 bg-negative/8 text-negative border px-3.5 py-2.5">
                {t.nothingToImport}
              </p>
            )}

            {step === "confirm" && (
              <section className="rounded-card border-line bg-surface-2 border p-5">
                <h3 className="type-card text-[1.0625rem]">{demo ? t.demoTitle : t.confirmTitle}</h3>
                <p className="text-ink-muted mt-1.5 max-w-prose">{demo ? t.demoBody : t.confirmBody}</p>
                {failure && (
                  <p role="alert" className="rounded-input border-negative/30 bg-negative/8 text-negative mt-4 border px-3.5 py-2.5">
                    <span className="font-medium">{t.failedTitle}.</span>{" "}
                    {failure === "limit" ? t.limitReached : failure === "partial" ? t.failedPartial : t.failedBody}
                  </p>
                )}
                {progress && (
                  <div className="mt-4" role="status">
                    <p className="tabular-nums">
                      {fill(t.importing, { done: whole.format(progress.done), total: whole.format(progress.total) })}
                    </p>
                    <div className="bg-line mt-2 h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-brand h-full rounded-full transition-[width] duration-200"
                        style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => !progress && setStep(step === "validate" ? "map" : "validate")}
                aria-disabled={!!progress || undefined}
                className={secondary}
              >
                {t.back}
              </button>
              {step === "validate" ? (
                <button
                  type="button"
                  aria-disabled={validation.orders.length === 0 || undefined}
                  onClick={() => validation.orders.length > 0 && setStep("confirm")}
                  className={primary}
                >
                  {t.next}
                </button>
              ) : demo ? (
                <Link href="/signup" className={primary}>
                  {t.demoCta}
                </Link>
              ) : (
                <button type="button" aria-disabled={!!progress || undefined} onClick={store} className={primary}>
                  {fill(t.import, { count: whole.format(validation.orders.length) })}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "done" && result && validation && (
          <div className="flex flex-col items-start" role="status">
            <span className="bg-positive/10 text-positive flex size-12 items-center justify-center rounded-full">
              <CheckCircle2 aria-hidden="true" className="size-6" />
            </span>
            <h3 className="type-page mt-4 text-[1.5rem]">{t.doneTitle}</h3>
            <p className="text-ink-muted mt-2 text-[0.9375rem]">
              {fill(t.doneBody, {
                inserted: whole.format(result.inserted),
                skipped: whole.format(result.skipped + validation.skippedExisting),
                rejected: whole.format(validation.rejectedRows),
              })}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={overviewHref} className={primary}>
                {t.toOverview}
              </Link>
              <button type="button" onClick={reset} className={secondary}>
                {t.another}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
