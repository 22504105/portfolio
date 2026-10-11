import { describe, expect, it } from "vitest";
import { neutralise, toCsv } from "@/lib/export/csv";
import { exportCsv } from "@/lib/export/workspace";
import { summarize } from "@/lib/metrics/summary";
import { paginate, transactionRows, TRANSACTION_SORTS } from "@/lib/view/lists";
import { defaultRange, hrefWith, parseView, presets, sharedQuery } from "@/lib/view/state";
import { demoWorkspace, loadPage } from "@/lib/workspace";

const calendar = { firstDay: "2025-08-01", lastDay: "2026-09-30" };

describe("CSV", () => {
  it("stops text from running as a formula in a spreadsheet", () => {
    for (const dangerous of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx", '=HYPERLINK("http://evil","x")']) {
      expect(neutralise(dangerous).startsWith("'")).toBe(true);
    }
    expect(neutralise("Tea = good")).toBe("Tea = good");
    expect(neutralise("KK-10001")).toBe("KK-10001");
  });

  it("leaves numbers as numbers, negative ones too", () => {
    expect(toCsv(["a"], [[-12.5]])).toBe("﻿a\r\n-12.5\r\n");
  });

  it("quotes commas, quotes and line breaks, and writes nothing for a missing value", () => {
    expect(toCsv(["name", "note", "x"], [['Ann "A" Lee', "a,b\nc", null]])).toBe('﻿name,note,x\r\n"Ann ""A"" Lee","a,b\nc",\r\n');
  });

  it("neutralises a formula even when it also needs quoting", () => {
    expect(toCsv(["a"], [['=A1,"x"']])).toBe('﻿a\r\n"\'=A1,""x"""\r\n');
  });
});

describe("the view read from an address", () => {
  it("falls back to the last thirty days when the dates are missing or wrong", () => {
    const fallback = defaultRange(calendar);
    expect(fallback).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    for (const params of [
      {},
      { from: "2026-09-10" },
      { from: "nope", to: "2026-09-30" },
      { from: "2026-09-30", to: "2026-09-01" },
      { from: "2026-02-30", to: "2026-03-01" },
    ]) {
      expect(parseView(params, calendar).range).toEqual(fallback);
    }
    expect(parseView({ from: "2026-01-01", to: "2026-01-31" }, calendar).range).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("ignores what it does not recognise instead of trusting it", () => {
    const view = parseView(
      {
        status: "completed,evil,refunded",
        g: "century",
        by: "password",
        sort: "__proto__",
        page: "-3",
        q: "x".repeat(500),
        channel: ["Email", "Direct"],
      },
      calendar,
      TRANSACTION_SORTS,
      "date",
    );
    expect(view.filters.statuses).toEqual(["completed", "refunded"]);
    expect(view.granularity).toBe("day");
    expect(view.dimension).toBe("channel");
    expect(view.sort).toBe("date");
    expect(view.page).toBe(1);
    expect(view.query).toHaveLength(120);
    expect(view.filters.channel).toBe("Email");
  });

  it("builds addresses: a new filter starts at page 1 and closes any drawer", () => {
    const params = { from: "2026-09-01", to: "2026-09-30", page: "3", order: "KK-1", q: "tea" };
    expect(hrefWith("/demo/transactions", params, { channel: "Email" })).toBe(
      "/demo/transactions?from=2026-09-01&to=2026-09-30&q=tea&channel=Email",
    );
    expect(hrefWith("/demo/transactions", params, { page: 4 })).toBe("/demo/transactions?from=2026-09-01&to=2026-09-30&page=4&q=tea");
    expect(hrefWith("/demo/transactions", params, { q: null })).toBe("/demo/transactions?from=2026-09-01&to=2026-09-30");
    expect(hrefWith("/demo/transactions", {}, { order: "KK-2" })).toBe("/demo/transactions?order=KK-2");
  });

  it("carries the period and the filters to another section, and nothing else", () => {
    expect(sharedQuery({ from: "2026-09-01", to: "2026-09-30", channel: "Email", page: "3", q: "tea", order: "KK-1" })).toBe(
      "?from=2026-09-01&to=2026-09-30&channel=Email",
    );
    expect(sharedQuery(new URLSearchParams("sort=amount"))).toBe("");
  });

  it("offers ready-made periods counted from the last day with data", () => {
    const byKey = Object.fromEntries(presets(calendar).map((preset) => [preset.key, preset.range]));
    expect(byKey.last7).toEqual({ from: "2026-09-24", to: "2026-09-30" });
    expect(byKey.thisMonth).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(byKey.lastMonth).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(byKey.all).toEqual({ from: "2025-08-01", to: "2026-09-30" });
  });
});

describe("tables and their exports", () => {
  const context = demoWorkspace();

  it("lists the same orders the headline figures are made of", () => {
    const page = loadPage(context, "transactions", { channel: "Email" }, TRANSACTION_SORTS, "date");
    const rows = transactionRows(page);
    expect(summarize(rows)).toEqual(page.comparison.current);
    // Newest first by default.
    expect(rows[0].placedAt).toBeGreaterThanOrEqual(rows.at(-1)!.placedAt);
  });

  it("searches by order number, customer and product", () => {
    const find = (q: string) =>
      transactionRows(loadPage(context, "transactions", { q, from: "2025-08-01", to: "2026-09-30" }, TRANSACTION_SORTS, "date"));
    expect(find("KK-10001").map((order) => order.externalId)).toEqual(["KK-10001"]);
    expect(find("matcha").every((order) => order.lines.some((line) => line.productName?.includes("Matcha")))).toBe(true);
    expect(find("no such thing anywhere")).toEqual([]);
  });

  it("sorts by amount both ways", () => {
    const rows = (dir?: string) =>
      transactionRows(loadPage(context, "transactions", { sort: "amount", ...(dir ? { dir } : {}) }, TRANSACTION_SORTS, "date"));
    const descending = rows().map((order) => order.netMinor);
    expect(descending).toEqual([...descending].sort((a, b) => b - a));
    const ascending = rows("asc").map((order) => order.netMinor);
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
  });

  it("brings a page number past the end back to the last page", () => {
    expect(paginate([1, 2, 3, 4, 5], 99, 2)).toEqual({ rows: [5], page: 3 });
    expect(paginate([], 4, 10)).toEqual({ rows: [], page: 1 });
  });

  it("exports exactly the rows the page lists", async () => {
    const params = { channel: "Email", status: "completed" };
    const page = loadPage(context, "transactions", params, TRANSACTION_SORTS, "date");
    const response = exportCsv(context, "transactions", params);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="flowly-transactions-2026-09-01-to-2026-09-30.csv"');
    const lines = (await response.text()).trim().split("\r\n");
    expect(lines).toHaveLength(transactionRows(page).length + 1);
    expect(lines[1].startsWith(transactionRows(page)[0].externalId + ",")).toBe(true);
  });

  it("exports a breakdown whose revenue column adds up to net revenue", async () => {
    const page = loadPage(context, "analytics", { by: "category" });
    const lines = (await exportCsv(context, "breakdown", { by: "category" }).text()).trim().split("\r\n").slice(1);
    const cents = lines.reduce((sum, line) => sum + Math.round(Number(line.split(",")[1]) * 100), 0);
    expect(cents).toBe(page.comparison.current.netRevenueMinor);
  });
});
