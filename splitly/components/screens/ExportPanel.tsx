"use client";

import { DatabaseBackup, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { Button, Field, inputClass, Problem } from "@/components/ui/controls";
import { monthOf } from "@/lib/analytics/summary";
import type { Group } from "@/lib/domain/types";
import { backupOf, saveFile } from "@/lib/export/backup";
import { buildReport, fileName, reportCsv, SECTIONS, type ReportFilter, type ReportWords, type Section } from "@/lib/export/report";
import { toXlsx } from "@/lib/export/xlsx";
import { fill } from "@/lib/i18n";
import { today } from "@/lib/split/form";
import { cn } from "@/lib/utils";
import { formatDay } from "./parts";

const PERIODS = ["all", "month", "last"] as const;

/**
 * A group's figures as files: a spreadsheet (CSV or XLSX) and a PDF, each
 * made on the device from the same tables, for the sections, period and
 * currency chosen. Nothing is sent anywhere, and nothing is converted.
 */
export function ExportPanel({ group }: { group: Group }) {
  const { t, locale } = useApp();
  const [sections, setSections] = useState<readonly Section[]>(["expenses"]);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("all");
  const [currency, setCurrency] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const currencies = [
    ...new Set([group.baseCurrency, ...group.expenses.map((item) => item.currency), ...group.settlements.map((item) => item.currency)]),
  ].sort();

  const range = period === "all" ? null : monthOf(today(), period === "last" ? -1 : 0);
  const filter: ReportFilter = { sections, from: range?.from ?? null, to: range?.to ?? null, currency: currency || null };
  /** For a spreadsheet to be read by a program, the bare keys; for a person, their own words. */
  const words = (plain: boolean): ReportWords => ({
    sections: t.export.sections,
    expenses: t.export.columns,
    debts: t.export.debtColumns,
    payments: t.export.paymentColumns,
    category: (key) => (plain ? (key ?? "") : key ? t.expense.categories[key as keyof typeof t.expense.categories] : t.expense.noCategory),
    expenseState: (key) => (plain ? key : t.export.states[key as keyof typeof t.export.states]),
    paymentState: (key) => (plain ? key : t.debts.states[key as keyof typeof t.debts.states]),
    empty: t.export.empty,
  });

  function ready(): boolean {
    setProblem(sections.length === 0 ? t.export.nothing : null);
    return sections.length > 0;
  }

  function csv() {
    if (!ready()) return;
    saveFile(reportCsv(buildReport(group, filter, words(true))), fileName(group.name, "csv"), "text/csv;charset=utf-8");
  }

  function xlsx() {
    if (!ready()) return;
    saveFile(
      toXlsx(buildReport(group, filter, words(false))),
      fileName(group.name, "xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }

  async function pdf() {
    if (!ready()) return;
    setBusy(true);
    try {
      const font = async (name: string) => {
        const response = await fetch(`/fonts/${name}.ttf`);
        if (!response.ok) throw new Error("font");
        return response.arrayBuffer();
      };
      const [{ toPdf }, regular, bold] = await Promise.all([import("@/lib/export/pdf"), font("Inter-Regular"), font("Inter-SemiBold")]);
      const bytes = await toPdf(
        buildReport(group, filter, words(false)),
        {
          title: `Splitly · ${group.name}`,
          lines: [
            `${t.export.periods[period]}${range ? ` (${formatDay(range.from, locale, true)} – ${formatDay(range.to, locale, true)})` : ""} · ${currency || t.export.allCurrencies}`,
            fill(t.export.made, { date: formatDay(today(), locale, true) }),
          ],
          page: (n, of) => fill(t.export.page, { n, of }),
          empty: t.export.empty,
        },
        { regular, bold },
      );
      saveFile(bytes, fileName(group.name, "pdf"), "application/pdf");
    } catch {
      setProblem(t.export.pdfFailed);
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="group-export" className="card flex flex-col gap-4 p-4 sm:p-5">
      <div>
        <h3 id="group-export" className="font-semibold">
          {t.export.title}
        </h3>
        <p className="type-small text-ink-muted mt-1">{t.export.lead}</p>
      </div>

      <fieldset>
        <legend className="type-small font-semibold">{t.export.what}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SECTIONS.map((section) => {
            const on = sections.includes(section);
            return (
              <label
                key={section}
                className={cn(
                  "type-small has-focus-visible:outline-primary inline-flex h-11 cursor-pointer items-center rounded-full border px-4 font-semibold transition-colors has-focus-visible:outline-2",
                  on ? "bg-accent text-on-accent border-transparent" : "border-field bg-surface text-ink hover:bg-surface-2",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => setSections(SECTIONS.filter((name) => (name === section ? !on : sections.includes(name))))}
                />
                {t.export.sections[section]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.export.period}>
          {(control) => (
            <select {...control} className={inputClass} value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
              {PERIODS.map((option) => (
                <option key={option} value={option}>
                  {t.export.periods[option]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t.export.currency}>
          {(control) => (
            <select {...control} className={inputClass} value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="">{t.export.allCurrencies}</option>
              {currencies.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {problem && <Problem>{problem}</Problem>}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" onClick={csv}>
          <Download aria-hidden="true" className="size-4" />
          {t.export.button}
        </Button>
        <Button variant="secondary" onClick={xlsx}>
          <FileSpreadsheet aria-hidden="true" className="size-4" />
          {t.export.xlsx}
        </Button>
        <Button variant="secondary" busy={busy} onClick={pdf}>
          <FileText aria-hidden="true" className="size-4" />
          {t.export.pdf}
        </Button>
      </div>
    </section>
  );
}

/** Everything Splitly holds for this person, as one file to keep. Read fresh from the store when asked for. */
export function BackupButton() {
  const { t, store, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setProblem(null);
    try {
      const list = await store.listGroups();
      const groups = (await Promise.all(list.map((group) => store.getGroup(group.id)))).filter((group): group is Group => group !== null);
      const at = new Date().toISOString();
      saveFile(JSON.stringify(backupOf(groups, at), null, 2), `splitly-backup-${at.slice(0, 10)}.json`, "application/json");
      notify(t.export.saved);
    } catch (caught) {
      setProblem(errorText(t, caught));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="bg-surface-2 text-ink flex size-11 shrink-0 items-center justify-center rounded-[12px]">
          <DatabaseBackup className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">{t.export.backupTitle}</h3>
          <p className="text-ink-muted text-[0.8125rem] leading-5">{t.export.backupHint}</p>
        </div>
      </div>
      {problem && <Problem>{problem}</Problem>}
      <Button variant="secondary" busy={busy} onClick={download}>
        <Download aria-hidden="true" className="size-4" />
        {t.export.backupButton}
      </Button>
    </div>
  );
}
