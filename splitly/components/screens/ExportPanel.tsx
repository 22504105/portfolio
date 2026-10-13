"use client";

import { DatabaseBackup, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { Button, Field, inputClass, Problem } from "@/components/ui/controls";
import type { Group } from "@/lib/domain/types";
import { handOver, saveFile } from "@/lib/export/backup";
import { makeBackup, makeReport, PERIODS, type ReportAsk } from "@/lib/export/make";
import { SECTIONS, type Section } from "@/lib/export/report";
import { today } from "@/lib/split/form";
import { cn } from "@/lib/utils";

/**
 * How a file reaches the person. Where the data lives on the server (a real
 * account, inside Telegram) the page cannot save a file it made itself, so it
 * asks the server for a short-lived address and hands that to Telegram's own
 * downloader, or to the phone's browser. In the demo the data is on the page,
 * and the page makes and saves the file.
 */
function useDelivery() {
  const { t, store, notify } = useApp();
  return async (ask: unknown, local: () => Promise<{ content: string | Uint8Array; name: string; type: string }>) => {
    if (store.downloadLink) {
      const by = handOver(await store.downloadLink(ask));
      notify(by === "telegram" ? t.export.viaTelegram : t.export.viaBrowser);
      return;
    }
    const file = await local();
    saveFile(file.content, file.name, file.type);
  };
}

/**
 * A group's figures as files: a spreadsheet (CSV or XLSX) and a PDF, each
 * made from the same tables, for the sections, period and currency chosen.
 * Nothing is converted: every amount stays in its own currency.
 */
export function ExportPanel({ group }: { group: Group }) {
  const { t, locale } = useApp();
  const deliver = useDelivery();
  const [sections, setSections] = useState<readonly Section[]>(["expenses"]);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("all");
  const [currency, setCurrency] = useState("");
  const [busy, setBusy] = useState<ReportAsk["format"] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const currencies = [
    ...new Set([group.baseCurrency, ...group.expenses.map((item) => item.currency), ...group.settlements.map((item) => item.currency)]),
  ].sort();

  async function download(format: ReportAsk["format"]) {
    if (sections.length === 0) return setProblem(t.export.nothing);
    setProblem(null);
    setBusy(format);
    const report: ReportAsk = { format, sections: [...sections], period, currency: currency || null, day: today() };
    try {
      await deliver({ kind: "report", groupId: group.id, locale, report }, () =>
        makeReport(group, report, t, locale, async () => {
          const font = async (name: string) => {
            const response = await fetch(`/fonts/${name}.ttf`);
            if (!response.ok) throw new Error("font");
            return response.arrayBuffer();
          };
          return { regular: await font("Inter-Regular"), bold: await font("Inter-SemiBold") };
        }),
      );
    } catch (caught) {
      setProblem(caught instanceof Error && caught.message === "font" ? t.export.pdfFailed : errorText(t, caught));
    }
    setBusy(null);
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
        <Button variant="secondary" busy={busy === "csv"} onClick={() => download("csv")}>
          <Download aria-hidden="true" className="size-4" />
          {t.export.button}
        </Button>
        <Button variant="secondary" busy={busy === "xlsx"} onClick={() => download("xlsx")}>
          <FileSpreadsheet aria-hidden="true" className="size-4" />
          {t.export.xlsx}
        </Button>
        <Button variant="secondary" busy={busy === "pdf"} onClick={() => download("pdf")}>
          <FileText aria-hidden="true" className="size-4" />
          {t.export.pdf}
        </Button>
      </div>
    </section>
  );
}

/** Everything Splitly holds for this person, as one file to keep. Read fresh when asked for. */
export function BackupButton() {
  const { t, store, notify } = useApp();
  const deliver = useDelivery();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setProblem(null);
    try {
      await deliver({ kind: "backup" }, async () => {
        const list = await store.listGroups();
        const groups = (await Promise.all(list.map((group) => store.getGroup(group.id)))).filter((group): group is Group => group !== null);
        notify(t.export.saved);
        return makeBackup(groups, new Date().toISOString());
      });
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
