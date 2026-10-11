import { readFileSync } from "node:fs";
import { join } from "node:path";
import readXlsxFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { suggestMapping, suggestOptions } from "@/lib/import/mapping";
import { toPayload, validationLog } from "@/lib/import/persist";
import { decodeText, fileKind, parseCsv, toTable, unpackedSize } from "@/lib/import/table";
import { LIMITS, type Cell } from "@/lib/import/types";
import { validate } from "@/lib/import/validate";
import { safeNext } from "@/lib/safe-next";

const SAMPLES = join(import.meta.dirname, "../public/samples");
const target = { currency: "USD", timezone: "America/New_York" };

describe("the sample files offered on the Imports page", () => {
  it("the CSV imports as it is: every row, no issue, nothing to decide", () => {
    const bytes = new Uint8Array(readFileSync(join(SAMPLES, "flowly-sample.csv")));
    expect(fileKind("flowly-sample.csv", bytes)).toBe("csv");
    const table = toTable(parseCsv(decodeText(bytes).text).rows);
    const mapping = suggestMapping(table.headers);
    // Every column of the sample is recognised from its heading.
    expect(Object.keys(mapping)).toHaveLength(table.headers.length);
    const options = suggestOptions(table, mapping);
    expect(options).toMatchObject({ interpretation: "order_per_row", defaultStatus: null });

    const result = validate(table, mapping, options, target, new Set());
    expect(result.issues).toEqual([]);
    expect(result).toMatchObject({ rowCount: 60, acceptedRows: 60, rejectedRows: 0 });
    expect(result.orders).toHaveLength(60);
    expect(result.anonymousOrders).toBeGreaterThan(0);
    expect(new Set(result.orders.map((order) => order.status))).toEqual(new Set(["completed", "refunded", "cancelled", "pending"]));
    for (const order of result.orders) expect(order.grossMinor - order.discountMinor).toBe(order.netMinor);
  });

  it("the Excel template imports as it is, with real dates and numbers", async () => {
    const buffer = readFileSync(join(SAMPLES, "flowly-template.xlsx"));
    const bytes = new Uint8Array(buffer);
    expect(fileKind("flowly-template.xlsx", bytes)).toBe("xlsx");
    expect(unpackedSize(bytes)).toBeLessThan(LIMITS.unpackedBytes);

    const [sheet] = await readXlsxFile(buffer);
    const table = toTable(sheet.data as unknown as Cell[][]);
    const mapping = suggestMapping(table.headers);
    const result = validate(table, mapping, suggestOptions(table, mapping), target, new Set());
    expect(result.issues).toEqual([]);
    expect(result.orders).toHaveLength(8);
    // 2026-07-01 15:17 in the sheet is a New York clock time: 19:17 UTC.
    expect(new Date(result.orders[0].placedAt).toISOString()).toBe("2026-07-01T19:17:00.000Z");
    expect(result.orders[0].netMinor).toBe(5600);
  });
});

describe("what is sent to the database", () => {
  it("writes amounts as exact decimal text", () => {
    const table = toTable(parseCsv("order,date,total,status,customer id\nA-1,2026-09-14 10:00,19.90,paid,C1\n").rows);
    const mapping = suggestMapping(table.headers);
    const { orders } = validate(table, mapping, suggestOptions(table, mapping), target, new Set());
    expect(toPayload(orders[0], "USD")).toEqual({
      external_id: "A-1",
      placed_at: "2026-09-14T14:00:00.000Z",
      status: "completed",
      channel: null,
      gross: "19.90",
      discount: "0.00",
      net: "19.90",
      refund: "0.00",
      customer: { identity_key: "id:C1", external_id: "C1", name: null, email: null },
      lines: [{ product: null, category: null, quantity: 1, unit_price: "19.90", gross: "19.90", discount: "0.00", net: "19.90" }],
    });
  });

  it("keeps a bounded log of what was left out", () => {
    const rows = Array.from({ length: 500 }, (_, index) => `A-${index},not a date,5,paid`).join("\n");
    const table = toTable(parseCsv(`order,date,total,status\n${rows}\n`).rows);
    const mapping = suggestMapping(table.headers);
    const result = validate(table, mapping, suggestOptions(table, mapping), target, new Set());
    const log = validationLog(result.issues, result);
    expect(log.total).toBe(500);
    expect(log.issues).toHaveLength(200);
    // The offending values are not copied into the log: only where and why.
    expect(Object.keys(log.issues[0]).sort()).toEqual(["code", "field", "message", "row", "severity"]);
  });
});

describe("where to go after signing in", () => {
  it("follows only paths inside the application", () => {
    expect(safeNext("/app/imports")).toBe("/app/imports");
    expect(safeNext("/app/transactions?order=A-1")).toBe("/app/transactions?order=A-1");
    expect(safeNext("/update-password")).toBe("/update-password");
    for (const hostile of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/app//evil.example",
      "/apple",
      "/demo",
      "javascript:alert(1)",
      "/app/\nx",
      "",
      null,
      5,
    ]) {
      expect([hostile, safeNext(hostile)]).toEqual([hostile, "/app/overview"]);
    }
  });
});
