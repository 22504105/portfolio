import { monthOf } from "@/lib/analytics/summary";
import type { Group } from "@/lib/domain/types";
import { fill, type Dictionary, type Locale } from "@/lib/i18n";
import { isCurrencyCode } from "@/lib/money/currency";
import { backupOf } from "./backup";
import { buildReport, fileName, reportCsv, SECTIONS, type ReportWords, type Section } from "./report";
import { toXlsx } from "./xlsx";

// One way to make each file a person can take away, used in two places: in
// the browser (the demo, where the data lives) and on the server (a real
// account, where Telegram's own downloader fetches the file by its address,
// because the browser inside Telegram cannot save a file made on the page).
// Both get the same bytes for the same request.

export const FORMATS = ["csv", "xlsx", "pdf"] as const;
export const PERIODS = ["all", "month", "last"] as const;

export type ReportAsk = {
  format: (typeof FORMATS)[number];
  sections: Section[];
  period: (typeof PERIODS)[number];
  /** One currency, or null for all. */
  currency: string | null;
  /** The asker's own "today", YYYY-MM-DD: this month and last month are theirs, not the server's. */
  day: string;
};

export type MadeFile = { content: string | Uint8Array; name: string; type: string };

const TYPES = {
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  json: "application/json",
} as const;

const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** A request for a report as it arrives from outside, checked; null if any part of it is not what it should be. */
export function checkReportAsk(raw: unknown): ReportAsk | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { format, sections, period, currency, day } = raw as Record<string, unknown>;
  if (!FORMATS.includes(format as ReportAsk["format"]) || !PERIODS.includes(period as ReportAsk["period"]) || !isDay(day)) return null;
  if (!Array.isArray(sections) || sections.length === 0 || sections.some((section) => !SECTIONS.includes(section))) return null;
  if (currency !== null && !isCurrencyCode(currency)) return null;
  // In the order the sections always go, each once.
  return {
    format: format as ReportAsk["format"],
    sections: SECTIONS.filter((section) => sections.includes(section)),
    period: period as ReportAsk["period"],
    currency: (currency as string | null) ?? null,
    day,
  };
}

/** For a spreadsheet a program will read, the bare keys; for a person, their own words. */
function wordsOf(t: Dictionary, plain: boolean): ReportWords {
  return {
    sections: t.export.sections,
    expenses: t.export.columns,
    debts: t.export.debtColumns,
    payments: t.export.paymentColumns,
    category: (key) => (plain ? (key ?? "") : key ? t.expense.categories[key as keyof typeof t.expense.categories] : t.expense.noCategory),
    expenseState: (key) => (plain ? key : t.export.states[key as keyof typeof t.export.states]),
    paymentState: (key) => (plain ? key : t.debts.states[key as keyof typeof t.debts.states]),
    empty: t.export.empty,
  };
}

const longDay = (day: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

/** The report asked for, as a file. `fonts` is called only for a PDF: where the two font files come from differs by place. */
export async function makeReport(
  group: Group,
  ask: ReportAsk,
  t: Dictionary,
  locale: Locale,
  fonts: () => Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }>,
): Promise<MadeFile> {
  const range = ask.period === "all" ? null : monthOf(ask.day, ask.period === "last" ? -1 : 0);
  const filter = { sections: ask.sections, from: range?.from ?? null, to: range?.to ?? null, currency: ask.currency };
  const name = fileName(group.name, ask.format);
  if (ask.format === "csv") return { content: reportCsv(buildReport(group, filter, wordsOf(t, true))), name, type: TYPES.csv };
  const tables = buildReport(group, filter, wordsOf(t, false));
  if (ask.format === "xlsx") return { content: toXlsx(tables), name, type: TYPES.xlsx };

  const { toPdf } = await import("./pdf");
  const content = await toPdf(
    tables,
    {
      title: `Splitly · ${group.name}`,
      lines: [
        `${t.export.periods[ask.period]}${range ? ` (${longDay(range.from, locale)} – ${longDay(range.to, locale)})` : ""} · ${ask.currency ?? t.export.allCurrencies}`,
        fill(t.export.made, { date: longDay(ask.day, locale) }),
      ],
      page: (n, of) => fill(t.export.page, { n, of }),
      empty: t.export.empty,
    },
    await fonts(),
  );
  return { content, name, type: TYPES.pdf };
}

/** Everything a person has, as the backup file. */
export function makeBackup(groups: readonly Group[], at: string): MadeFile {
  return { content: JSON.stringify(backupOf(groups, at), null, 2), name: `splitly-backup-${at.slice(0, 10)}.json`, type: TYPES.json };
}
