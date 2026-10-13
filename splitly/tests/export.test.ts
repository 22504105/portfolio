import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import type { Group } from "@/lib/domain/types";
import { backupOf } from "@/lib/export/backup";
import { columnWidths, toPdf, wrap } from "@/lib/export/pdf";
import { buildReport, fileName, plain, reportCsv, type ReportFilter, type ReportWords } from "@/lib/export/report";
import { toXlsx, zip } from "@/lib/export/xlsx";
import { createDemoStore, type Shelf } from "@/lib/store/demo";

// The files a person can take away: the same tables as CSV, XLSX and PDF, and
// the backup. Made from the demo's two groups, which have several currencies,
// a cancelled expense, a refund and payments in every state.

const words: ReportWords = {
  sections: { expenses: "Expenses", debts: "Debts", payments: "Payments" },
  expenses: ["Date", "Description", "Category", "Amount", "Currency", "State", "Paid by", "Shares"],
  debts: ["From", "To", "Amount", "Currency"],
  payments: ["Date", "From", "To", "Amount", "Currency", "State"],
  category: (key) => key ?? "",
  expenseState: (key) => key,
  paymentState: (key) => key,
  empty: "Nothing",
};
const everything: ReportFilter = { sections: ["expenses", "debts", "payments"], from: null, to: null, currency: null };

let istanbul: Group;
let flat: Group;
let all: Group[];

beforeAll(async () => {
  const data: Record<string, string> = {};
  const shelf: Shelf = {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => void (data[key] = value),
    removeItem: (key) => void delete data[key],
  };
  const store = createDemoStore(shelf, "en");
  istanbul = (await store.getGroup("demo-istanbul"))!;
  flat = (await store.getGroup("demo-flat"))!;
  all = [istanbul, flat];
});

/** Reads a stored ZIP back: every file's name and text, checking sizes against the directory at the end. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files: Record<string, string> = {};
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const start = offset + 30 + view.getUint16(offset + 26, true);
    files[name] = decoder.decode(bytes.subarray(start, start + size));
    at += 46 + nameLength;
  }
  return files;
}

describe("the tables of a report", () => {
  it("lists every expense with exact amounts, and the debts exactly as the Debts tab works them out", () => {
    const [expenses, debts, payments] = buildReport(istanbul, everything, words);
    expect(expenses.rows).toHaveLength(istanbul.expenses.length);
    expect(expenses.rows.find((row) => row[1] === "Taxi from the airport")).toMatchObject({ 3: "950.00", 4: "TRY", 5: "active" });
    // The demo's own figures: Kerem and Deniz owe Alex, Deniz owes Mira.
    expect(debts.rows).toEqual([
      ["Kerem", "Alex", "830.12", "TRY"],
      ["Deniz", "Alex", "632.25", "TRY"],
      ["Deniz", "Mira", "44.88", "TRY"],
    ]);
    expect(payments.rows).toEqual([[expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), "Deniz", "Alex", "300.00", "TRY", "proposed"]]);
  });

  it("keeps to the currency and the period asked for, and never adds currencies together", () => {
    const euros = buildReport(flat, { ...everything, currency: "EUR" }, words);
    expect(euros[0].rows.every((row) => row[4] === "EUR")).toBe(true);
    expect(euros[1].rows.every((row) => row[3] === "EUR")).toBe(true);
    const lira = buildReport(flat, { ...everything, currency: "TRY" }, words);
    expect(lira[0].rows.length + euros[0].rows.length).toBe(flat.expenses.length);

    const day = flat.expenses[0].date;
    const oneDay = buildReport(flat, { ...everything, sections: ["expenses"], from: day, to: day }, words);
    expect(oneDay).toHaveLength(1);
    expect(oneDay[0].rows.length).toBe(flat.expenses.filter((expense) => expense.date === day).length);
    expect(buildReport(flat, { ...everything, sections: ["expenses"], from: "1990-01-01", to: "1990-01-31" }, words)[0].rows).toEqual([]);
  });

  it("writes one table as a plain CSV and several under their titles", () => {
    const one = reportCsv(buildReport(flat, { ...everything, sections: ["expenses"] }, words));
    expect(one.startsWith("﻿Date,Description,Category,Amount,Currency,State,Paid by,Shares\r\n")).toBe(true);
    expect(one).toContain('"Rent, October",lodging,1200.00,EUR,active,Nika: 1200.00,Alex: 480.00; Nika: 360.00; Sam: 360.00');
    const three = reportCsv(buildReport(flat, everything, words)).split("\r\n\r\n");
    expect(three.map((block) => block.replace("﻿", "").split("\r\n")[0])).toEqual(["Expenses", "Debts", "Payments"]);
  });

  it("makes text that a spreadsheet would run as a formula plain, and leaves amounts alone", () => {
    expect(plain("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(plain("@home")).toBe("'@home");
    expect(plain("-450.00")).toBe("-450.00");
    expect(plain("Dinner")).toBe("Dinner");
    expect(fileName("Flat in Moda", "xlsx")).toBe("splitly-Flat-in-Moda.xlsx");
    expect(fileName("///", "pdf")).toBe("splitly-group.pdf");
  });
});

describe("the workbook", () => {
  it("is a ZIP that reads back, with a sheet for each table", () => {
    const files = unzip(toXlsx(buildReport(istanbul, everything, words)));
    expect(Object.keys(files)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
      "xl/worksheets/sheet3.xml",
    ]);
    expect(files["xl/workbook.xml"]).toContain('<sheet name="Expenses" sheetId="1" r:id="rId1"/>');
    // An amount is a number, written as the exact text it is; a name is text.
    expect(files["xl/worksheets/sheet2.xml"]).toContain('<c r="C2" s="2"><v>830.12</v></c>');
    expect(files["xl/worksheets/sheet2.xml"]).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Kerem</t></is></c>');
  });

  it("escapes what XML reserves and stores files with a correct checksum", () => {
    const table = {
      section: "expenses" as const,
      title: "A/B: <1>",
      heading: ["Name"],
      numeric: [],
      rows: [['Fish & "chips" <hot>'], ["=1+1"]],
    };
    const files = unzip(toXlsx([table]));
    expect(files["xl/worksheets/sheet1.xml"]).toContain("Fish &amp; &quot;chips&quot; &lt;hot&gt;");
    expect(files["xl/worksheets/sheet1.xml"]).toContain("&apos;=1+1".replace("&apos;", "'"));
    expect(files["xl/workbook.xml"]).toContain('name="A B  &lt;1&gt;"');
    // CRC-32 of "hello" is 3610a686: the value every ZIP tool expects.
    const archive = zip([{ name: "a.txt", text: "hello" }]);
    expect(new DataView(archive.buffer).getUint32(14, true)).toBe(0x3610a686);
  });
});

describe("the PDF", () => {
  it("is a real PDF with Cyrillic and Turkish text, and runs over to more pages when it must", async () => {
    const fonts = {
      regular: new Uint8Array(readFileSync("public/fonts/Inter-Regular.ttf")).buffer,
      bold: new Uint8Array(readFileSync("public/fonts/Inter-SemiBold.ttf")).buffer,
    };
    const tables = buildReport(istanbul, everything, words);
    tables[0].rows.push([
      "2026-10-01",
      "Ужин в Каракёе, ığüşöç İĞÜŞÖÇ",
      "food",
      "1250.50",
      "TRY",
      "active",
      "Алексей: 1250.50",
      "Мира: 1250.50",
    ]);
    const text = {
      title: "Splitly · Выходные в Стамбуле",
      lines: ["Всё время · все валюты"],
      page: (n: number, of: number) => `${n}/${of}`,
      empty: "Пусто",
    };
    const bytes = await toPdf(tables, text, fonts);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    const read = await PDFDocument.load(bytes);
    expect(read.getPageCount()).toBe(1);
    expect(read.getTitle()).toBe("Splitly · Выходные в Стамбуле");

    const long = [{ ...tables[0], rows: Array.from({ length: 120 }, () => tables[0].rows[0]) }];
    expect((await PDFDocument.load(await toPdf(long, text, fonts))).getPageCount()).toBeGreaterThan(1);
    // Embedding two fonts twice takes a few seconds on a busy machine.
  }, 30_000);

  it("cuts text to the column, even a word longer than the column, and shares the page out between columns", () => {
    const measure = (value: string) => value.length;
    expect(wrap("one two three four", 9, measure)).toEqual(["one two", "three", "four"]);
    expect(wrap("abcdefghijkl", 5, measure)).toEqual(["abcde", "fghij", "kl"]);
    expect(wrap("", 5, measure)).toEqual([""]);
    const widths = columnWidths(
      { section: "debts", title: "", heading: ["A", "B"], numeric: [], rows: [["x".repeat(100), "y"]] },
      300,
      measure,
    );
    expect(Math.round(widths[0] + widths[1])).toBe(300);
    expect(widths[0]).toBeGreaterThan(widths[1]);
  });
});

describe("the backup", () => {
  it("holds every group whole, says what the amounts are, and leaves out photo addresses", () => {
    const withPhoto = { ...istanbul, members: istanbul.members.map((member) => ({ ...member, photoUrl: "https://t.me/i/userpic/1.jpg" })) };
    const backup = backupOf([withPhoto, flat], "2026-10-13T12:00:00.000Z");
    expect(backup).toMatchObject({ format: "splitly-backup", version: 1, amounts: "minor-units", exportedAt: "2026-10-13T12:00:00.000Z" });
    expect(backup.groups.map((group) => group.name)).toEqual(all.map((group) => group.name));
    expect(backup.groups[0].expenses).toEqual(istanbul.expenses);
    expect(backup.groups[0].settlements).toEqual(istanbul.settlements);
    expect(backup.groups[1].rates).toEqual(flat.rates);
    expect(backup.groups[0].members).toHaveLength(istanbul.members.length);
    expect(JSON.stringify(backup)).not.toContain("userpic");
    // It is plain JSON: what is written is what is read.
    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup);
  });
});
