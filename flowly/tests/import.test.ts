import { describe, expect, it } from "vitest";
import { missingRequired, suggestMapping, suggestOptions } from "@/lib/import/mapping";
import { decodeText, fileKind, ImportFileError, parseCsv, toTable, unpackedSize } from "@/lib/import/table";
import { LIMITS, type ImportOptions, type Mapping, type Table } from "@/lib/import/types";
import { validate } from "@/lib/import/validate";
import { detectDateOrder, parseAmount, parseDate, parseQuantity, parseStatus, zonedToUtc } from "@/lib/import/values";

const NY = "America/New_York";
const target = { currency: "USD", timezone: NY };
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const text = (value: string) => new TextEncoder().encode(value);

const OPTIONS: ImportOptions = {
  interpretation: "order_per_row",
  dateOrder: null,
  defaultStatus: null,
  generateIds: false,
  duplicates: "skip",
};

function table(csv: string): Table {
  return toTable(parseCsv(csv).rows);
}

/** Validates a CSV with its suggested mapping. */
function run(csv: string, options: Partial<ImportOptions> = {}, existing: string[] = [], mapping?: Mapping) {
  const data = table(csv);
  return validate(data, mapping ?? suggestMapping(data.headers), { ...OPTIONS, ...options }, target, new Set(existing));
}

describe("dates", () => {
  it("reads a clock time as the workspace's, through both clock changes", () => {
    // Winter: New York is 5 hours behind UTC; summer: 4.
    expect(iso(zonedToUtc(2026, 1, 15, 9, 30, 0, NY))).toBe("2026-01-15T14:30:00.000Z");
    expect(iso(zonedToUtc(2026, 7, 15, 9, 30, 0, NY))).toBe("2026-07-15T13:30:00.000Z");
    // The evening before and the morning after clocks go back (1 November 2026).
    expect(iso(zonedToUtc(2026, 10, 31, 23, 0, 0, NY))).toBe("2026-11-01T03:00:00.000Z");
    expect(iso(zonedToUtc(2026, 11, 1, 9, 0, 0, NY))).toBe("2026-11-01T14:00:00.000Z");
    expect(iso(zonedToUtc(2026, 3, 8, 12, 0, 0, NY))).toBe("2026-03-08T16:00:00.000Z");
  });

  it("reads the usual ways of writing a date", () => {
    expect(iso(parseDate("2026-09-14", NY, null))).toBe("2026-09-14T04:00:00.000Z");
    expect(iso(parseDate("2026-09-14 15:42", NY, null))).toBe("2026-09-14T19:42:00.000Z");
    expect(iso(parseDate("2026-09-14T15:42:10", NY, null))).toBe("2026-09-14T19:42:10.000Z");
    expect(iso(parseDate("14 Sep 2026", NY, null))).toBe("2026-09-14T04:00:00.000Z");
    expect(iso(parseDate("September 14, 2026 3:42 PM", NY, null))).toBe("2026-09-14T19:42:00.000Z");
    expect(iso(parseDate("14.09.2026 15:42", NY, "dmy"))).toBe("2026-09-14T19:42:00.000Z");
    expect(iso(parseDate("9/14/2026 12:05 am", NY, "mdy"))).toBe("2026-09-14T04:05:00.000Z");
  });

  it("takes a time with a UTC offset as the exact instant it is", () => {
    expect(iso(parseDate("2026-09-14T15:42:00Z", NY, null))).toBe("2026-09-14T15:42:00.000Z");
    expect(iso(parseDate("2026-09-14T15:42:00+02:00", NY, null))).toBe("2026-09-14T13:42:00.000Z");
  });

  it("reads spreadsheet dates and date numbers as clock times in the workspace", () => {
    expect(iso(parseDate(new Date(Date.UTC(2026, 8, 14, 15, 42)), NY, null))).toBe("2026-09-14T19:42:00.000Z");
    // 46279 is 14 September 2026 in a spreadsheet.
    expect(iso(parseDate(46279, NY, null))).toBe("2026-09-14T04:00:00.000Z");
  });

  it("will not guess between day-first and month-first", () => {
    expect(parseDate("03/04/2026", NY, null)).toBeNull();
    expect(iso(parseDate("03/04/2026", NY, "dmy"))).toBe("2026-04-03T04:00:00.000Z");
    expect(iso(parseDate("03/04/2026", NY, "mdy"))).toBe("2026-03-04T05:00:00.000Z");
    expect(detectDateOrder(["03/04/2026", "05/06/2026"])).toBe("ambiguous");
    expect(detectDateOrder(["03/04/2026", "25/06/2026"])).toBe("dmy");
    expect(detectDateOrder(["03/04/2026", "06/25/2026"])).toBe("mdy");
    expect(detectDateOrder(["25/06/2026", "06/25/2026"])).toBe("conflict");
    expect(detectDateOrder(["2026-06-25"])).toBe("none");
  });

  it("refuses what is not a date", () => {
    for (const bad of [
      "",
      "yesterday",
      "2026-02-30",
      "2026-13-01",
      "31/04/2026",
      "1999-12-31",
      "2026-09-14 25:00",
      "=TODAY()",
      "12345",
      5,
      true,
    ]) {
      expect([bad, parseDate(bad, NY, "dmy")]).toEqual([bad, null]);
    }
  });
});

describe("amounts", () => {
  it("reads the ways people write money", () => {
    const cases: [unknown, number][] = [
      ["19.90", 1990],
      ["1,234.56", 123456],
      ["1.234,56", 123456],
      ["19,9", 1990],
      ["$ 1 234.50", 123450],
      ["USD 45", 4500],
      ["45 €", 4500],
      ["1,234", 123400],
      ["1.234.567", 123456700],
      ["0.5", 50],
      [".5", 50],
      [19.9, 1990],
      ["(12.00)", -1200],
      ["-12", -1200],
    ];
    for (const [input, expected] of cases) expect([input, parseAmount(input as string, "USD")]).toEqual([input, expected]);
  });

  it("never treats a formula or a word as a number", () => {
    for (const bad of ["=1+1", "twelve", "", "1.2.3,4,5", "12abc34", "--5", true, new Date()]) {
      expect([bad, parseAmount(bad as string, "USD")]).toEqual([bad, null]);
    }
  });

  it("reads quantities as whole numbers of one or more", () => {
    expect([parseQuantity("3"), parseQuantity("2.0"), parseQuantity(4)]).toEqual([3, 2, 4]);
    expect([parseQuantity("2.5"), parseQuantity("0"), parseQuantity("-1"), parseQuantity("many"), parseQuantity("")]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("knows the words shops use for a status, and no others", () => {
    expect([parseStatus("Paid"), parseStatus("CANCELED"), parseStatus("on-hold"), parseStatus("Returned")]).toEqual([
      "completed",
      "cancelled",
      "pending",
      "refunded",
    ]);
    expect([parseStatus("maybe"), parseStatus("")]).toEqual([null, null]);
  });
});

describe("files", () => {
  it("goes by what a file is, not only by what it is called", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
    expect(fileKind("orders.csv", text("a,b\n1,2"))).toBe("csv");
    expect(fileKind("orders.XLSX", zip)).toBe("xlsx");
    expect(() => fileKind("orders.xlsx", text("a,b"))).toThrow(/not an Excel workbook/);
    expect(() => fileKind("orders.csv", zip)).toThrow(/zip archive/);
    expect(() => fileKind("orders.csv", new Uint8Array([65, 0, 66, 0, 67]))).toThrow(/not text/);
    expect(() => fileKind("orders.xlsm", zip)).toThrow(/Only .csv and .xlsx/);
    expect(() => fileKind("orders.exe", text("MZ"))).toThrow(ImportFileError);
    expect(() => fileKind("orders.csv", new Uint8Array(0))).toThrow(/empty/);
    expect(() => fileKind("orders.csv", new Uint8Array(LIMITS.fileBytes + 1))).toThrow(/larger than 5 MB/);
  });

  it("reads how big an archive will unpack to without unpacking it", () => {
    // A zip with one stored file of 5 bytes, written by hand.
    const name = text("a.txt");
    const local = new Uint8Array(30 + name.length + 5);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, 5, true);
    lv.setUint32(22, 5, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(text("hello"), 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(20, 5, true);
    cv.setUint32(24, 4_000_000_000, true); // claims to unpack to 4 GB
    cv.setUint16(28, name.length, true);
    central.set(name, 46);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, 1, true);
    ev.setUint16(10, 1, true);
    ev.setUint32(12, central.length, true);
    ev.setUint32(16, local.length, true);
    const zip = new Uint8Array([...local, ...central, ...end]);

    expect(unpackedSize(zip)).toBe(4_000_000_000);
    expect(unpackedSize(zip)).toBeGreaterThan(LIMITS.unpackedBytes);
    expect(() => unpackedSize(text("PK not really a zip at all, just some text"))).toThrow(/damaged/);
  });

  it("decodes UTF-8, UTF-16 and falls back with a note", () => {
    expect(decodeText(text("café")).text).toBe("café");
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00])).text.replace("﻿", "")).toBe("hi");
    const latin = decodeText(new Uint8Array([0x63, 0x61, 0x66, 0xe9]));
    expect(latin.text).toBe("café");
    expect(latin.note).toMatch(/not UTF-8/);
  });

  it("detects the delimiter and keeps quoted values whole", () => {
    expect(parseCsv("a;b\n1;2").delimiter).toBe(";");
    expect(parseCsv("a\tb\n1\t2").delimiter).toBe("\t");
    expect(parseCsv('id,note\n1,"said ""hi"", left"\n').rows[1]).toEqual(["1", 'said "hi", left']);
    expect(() => parseCsv('id,note\n1,"never closed\n2,x')).toThrow(/never closed/);
  });

  it("finds the header, numbers the lines as the file does, and names blank or repeated headings", () => {
    const data = toTable(parseCsv("Export from shop\n\nOrder,Total,Total,\nA-1,5,5,x\n\nA-2,6,6,y\n").rows);
    expect(data.headers).toEqual(["Order", "Total", "Total (2)", "Column 4"]);
    expect(data.rows).toHaveLength(2);
    // Blank lines were dropped by the CSV reader, so the first data row is line 3 of what was read.
    expect(data.firstRowNumber).toBe(3);
    expect(data.notes.join(" ")).toMatch(/header was found on line 2/);
  });

  it("refuses a file with no data, no header, or too much", () => {
    expect(() => toTable(parseCsv("a,b\n").rows)).toThrow(/no data under it/);
    expect(() => toTable([["only one column"], ["x"]])).toThrow(/No header row/);
    expect(() => toTable([[""], [null]])).toThrow(/no data/);
    const wide = [Array.from({ length: LIMITS.columns + 1 }, (_, i) => `c${i}`), ["x", "y"]];
    expect(() => toTable(wide)).toThrow(/more than 100 columns/);
    const long = [["a", "b"], ...Array.from({ length: LIMITS.rows + 1 }, () => ["1", "2"])];
    expect(() => toTable(long)).toThrow(/limit is 10,000/);
    expect(toTable(long.slice(0, LIMITS.rows + 1)).rows).toHaveLength(LIMITS.rows);
  });
});

describe("mapping", () => {
  it("suggests columns from their headings, each column once", () => {
    const headers = ["Order ID", "Order Date", "Customer", "Email", "Product", "Qty", "Unit Price", "Total", "Status", "Source"];
    expect(suggestMapping(headers)).toEqual({
      orderId: 0,
      orderDate: 1,
      customerName: 2,
      customerEmail: 3,
      product: 4,
      quantity: 5,
      unitPrice: 6,
      amount: 7,
      status: 8,
      channel: 9,
    });
  });

  it("does not map what it does not recognise", () => {
    expect(suggestMapping(["foo", "bar", "Notes"])).toEqual({});
  });

  it("says what is still needed", () => {
    expect(missingRequired({}, OPTIONS)).toEqual(["orderId", "orderDate", "amount"]);
    expect(missingRequired({ orderDate: 0, quantity: 1, unitPrice: 2 }, { ...OPTIONS, generateIds: true })).toEqual([]);
    // Row numbers cannot identify an order that spans several rows.
    expect(missingRequired({ orderDate: 0, amount: 1 }, { ...OPTIONS, generateIds: true, interpretation: "line_per_row" })).toEqual([
      "orderId",
    ]);
  });

  it("notices a file of order lines and an unambiguous date order", () => {
    const data = table("order,date,total\nA-1,25/06/2026,5\nA-1,25/06/2026,6\n");
    expect(suggestOptions(data, suggestMapping(data.headers))).toMatchObject({
      interpretation: "line_per_row",
      dateOrder: "dmy",
      defaultStatus: null,
    });
  });
});

describe("validation", () => {
  const good = "Order ID,Date,Customer ID,Customer Name,Email,Product,Category,Quantity,Unit Price,Discount,Total,Status,Channel\n";

  it("turns good rows into orders that add up", () => {
    const result = run(good + "A-1,2026-09-14 10:00,C1,Ann Lee,ANN@Example.com,Sencha,Tea,2,14.00,3.00,25.00,paid,Email\n");
    expect(result.issues).toEqual([]);
    expect(result.orders).toHaveLength(1);
    const [order] = result.orders;
    expect(order).toMatchObject({
      externalId: "A-1",
      status: "completed",
      channel: "Email",
      grossMinor: 2800,
      discountMinor: 300,
      netMinor: 2500,
      refundMinor: 0,
      rows: [2],
    });
    expect(iso(order.placedAt)).toBe("2026-09-14T14:00:00.000Z");
    expect(order.customer).toEqual({ identityKey: "id:C1", externalId: "C1", name: "Ann Lee", email: "ann@example.com" });
    expect(order.lines).toEqual([
      { productName: "Sencha", category: "Tea", quantity: 2, unitPriceMinor: 1400, grossMinor: 2800, discountMinor: 300, netMinor: 2500 },
    ]);
  });

  it("reports every bad row with its line and the reason, and keeps it out", () => {
    const result = run(
      "order,date,total,status\n" +
        "A-1,2026-09-14,10.00,paid\n" + // line 2: fine
        ",2026-09-14,10.00,paid\n" + // 3: no id
        "A-3,not a date,10.00,paid\n" + // 4
        "A-4,2026-09-14,ten,paid\n" + // 5
        "A-5,2026-09-14,-4.00,paid\n" + // 6
        "A-6,2026-09-14,10.00,sideways\n" + // 7
        "A-7,2026-09-14,10.00,\n" + // 8: no status, no default
        "A-1,2026-09-15,3.00,paid\n", // 9: same order number again
    );
    expect(result.orders.map((order) => order.externalId)).toEqual(["A-1"]);
    expect(result.issues.map((issue) => [issue.row, issue.field, issue.code])).toEqual([
      [3, "orderId", "missing"],
      [4, "orderDate", "bad_date"],
      [5, "amount", "bad_amount"],
      [6, "amount", "negative_amount"],
      [7, "status", "bad_status"],
      [8, "status", "missing"],
      [9, "orderId", "duplicate_in_file"],
    ]);
    expect(result).toMatchObject({ rowCount: 8, acceptedRows: 1, rejectedRows: 7 });
    expect(result.issues[3].value).toBe("-4.00");
  });

  it("uses a default status only when one was chosen", () => {
    const csv = "order,date,total\nA-1,2026-09-14,10\n";
    expect(run(csv).orders).toEqual([]);
    expect(run(csv, { defaultStatus: "completed" }).orders[0].status).toBe("completed");
  });

  it("asks which way round dates are instead of guessing", () => {
    const csv = "order,date,total,status\nA-1,03/04/2026,10,paid\n";
    expect(run(csv).issues.map((issue) => issue.code)).toEqual(["ambiguous_date"]);
    expect(iso(run(csv, { dateOrder: "dmy" }).orders[0].placedAt)).toBe("2026-04-03T04:00:00.000Z");
  });

  it("refuses another currency and never sums it in", () => {
    const result = run("order,date,total,status,currency\nA-1,2026-09-14,10,paid,usd\nA-2,2026-09-14,10,paid,EUR\n");
    expect(result.orders.map((order) => order.externalId)).toEqual(["A-1"]);
    expect(result.issues.map((issue) => [issue.row, issue.code])).toEqual([[3, "bad_currency"]]);
  });

  it("identifies customers by ID, then by email, and invents nobody", () => {
    const result = run(
      "order,date,total,status,customer id,email,customer name\n" +
        "A-1,2026-09-14,10,paid,C1,a@example.com,Ann\n" +
        "A-2,2026-09-14,10,paid,,B@Example.com,Bob\n" +
        "A-3,2026-09-14,10,paid,,,Just A Name\n" +
        "A-4,2026-09-14,10,paid,,not-an-email,\n",
    );
    expect(result.orders.map((order) => order.customer?.identityKey ?? null)).toEqual(["id:C1", "email:b@example.com", null, null]);
    expect(result.anonymousOrders).toBe(2);
    expect(result.issues).toMatchObject([{ row: 5, code: "bad_email", severity: "warning" }]);
    expect(result.rejectedRows).toBe(0);
  });

  it("joins the lines of an order, and adds it up once", () => {
    const result = run(
      "order,date,product,qty,unit price,status,channel\n" +
        "A-1,2026-09-14,Sencha,2,14.00,paid,Email\n" +
        "A-1,2026-09-14,Mug,1,18.00,paid,Email\n" +
        "A-2,2026-09-15,Kettle,1,69.00,paid,Direct\n",
      { interpretation: "line_per_row" },
    );
    expect(result.orders).toHaveLength(2);
    expect(result.orders[0]).toMatchObject({ externalId: "A-1", netMinor: 4600, rows: [2, 3] });
    expect(result.orders[0].lines.map((line) => line.productName)).toEqual(["Sencha", "Mug"]);
    expect(result.acceptedRows).toBe(3);
  });

  it("leaves out a whole order whose lines contradict each other", () => {
    const result = run(
      "order,date,product,total,status\n" +
        "A-1,2026-09-14,Sencha,10,paid\n" +
        "A-1,2026-09-14,Mug,5,cancelled\n" +
        "A-1,2026-09-14,Spoon,2,paid\n" +
        "A-2,2026-09-14,Tea,7,paid\n",
      { interpretation: "line_per_row" },
    );
    expect(result.orders.map((order) => order.externalId)).toEqual(["A-2"]);
    expect(result.issues).toMatchObject([{ row: 3, code: "conflict" }]);
    expect(result.issues[0].message).toMatch(/disagree about its status/);
    expect(result).toMatchObject({ acceptedRows: 1, rejectedRows: 3 });
  });

  it("handles refunds: full by status, partial by amount, never more than was paid", () => {
    const result = run(
      "order,date,total,status,refund\n" +
        "A-1,2026-09-14,10,refunded,\n" +
        "A-2,2026-09-14,10,paid,4\n" +
        "A-3,2026-09-14,10,paid,11\n" +
        "A-4,2026-09-14,10,cancelled,5\n",
    );
    expect(result.orders.map((order) => [order.externalId, order.status, order.refundMinor])).toEqual([
      ["A-1", "refunded", 1000],
      ["A-2", "completed", 400],
      ["A-4", "cancelled", 0],
    ]);
    expect(result.issues).toMatchObject([{ row: 4, code: "refund_too_large" }]);
  });

  it("skips or replaces orders the workspace already has, as chosen", () => {
    const csv = "order,date,total,status\nA-1,2026-09-14,10,paid\nA-2,2026-09-14,10,paid\n";
    const skipped = run(csv, {}, ["A-1"]);
    expect(skipped.orders.map((order) => order.externalId)).toEqual(["A-2"]);
    expect(skipped).toMatchObject({ skippedExisting: 1, replacing: [] });
    const replaced = run(csv, { duplicates: "replace" }, ["A-1"]);
    expect(replaced.orders).toHaveLength(2);
    expect(replaced).toMatchObject({ skippedExisting: 0, replacing: ["A-1"] });
  });

  it("numbers orders by row only when asked, and says so", () => {
    const csv = "date,total,status\n2026-09-14,10,paid\n2026-09-14,12,paid\n";
    expect(run(csv).orders).toEqual([]);
    const result = run(csv, { generateIds: true });
    expect(result.orders.map((order) => order.externalId)).toEqual(["ROW-2", "ROW-3"]);
    expect(result.generatedIds).toBe(true);
  });

  it("keeps cell text as text: formulas and markup are data, not instructions", () => {
    const result = run(
      'order,date,total,status,product\nA-1,2026-09-14,10,paid,"=HYPERLINK(""http://x"",""click"")"\nA-2,2026-09-14,10,paid,<img src=x onerror=alert(1)>\n',
    );
    expect(result.orders.map((order) => order.lines[0].productName)).toEqual([
      '=HYPERLINK("http://x","click")',
      "<img src=x onerror=alert(1)>",
    ]);
    // A formula where a number belongs is not a number.
    expect(run("order,date,total,status\nA-1,2026-09-14,=1+1,paid\n").issues[0].code).toBe("bad_amount");
  });

  it("refuses text that is far too long", () => {
    const result = run(`order,date,total,status,product\nA-1,2026-09-14,10,paid,${"x".repeat(LIMITS.cellLength + 1)}\n`);
    expect(result.issues).toMatchObject([{ row: 2, field: "product", code: "too_long" }]);
    expect(result.orders).toEqual([]);
  });

  it("works from quantity and unit price when there is no total, and warns when numbers disagree", () => {
    const result = run("order,date,qty,unit price,discount,status\nA-1,2026-09-14,3,5.00,2.50,paid\nA-2,2026-09-14,1,5.00,9.00,paid\n");
    expect(result.orders.map((order) => [order.grossMinor, order.discountMinor, order.netMinor])).toEqual([
      [1500, 250, 1250],
      [500, 500, 0],
    ]);
    expect(result.issues).toMatchObject([{ row: 3, code: "conflict", severity: "warning" }]);
  });
});
