import { describe, expect, it } from "vitest";
import { monthOf, summarise, toCsv } from "@/lib/analytics/summary";
import { pairwise, simplify, simplifyAll, type Transfer } from "@/lib/balances/debts";
import { netsOf } from "@/lib/balances/net";
import type { Expense, ExpenseInput, Settlement } from "@/lib/domain/types";
import { toDecimalString } from "@/lib/money/amount";
import { convert, parseRate, rateOn, type Rate } from "@/lib/money/fx";
import { checkExpense } from "@/lib/split/expense";

const PEOPLE = ["ann", "bob", "cy", "dee"];
const MEMBERS = new Set(PEOPLE);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

let made = 0;
const expense = (
  payers: Record<string, number>,
  among: string[] | Record<string, number>,
  extra: Partial<ExpenseInput & { status: Expense["status"] }> = {},
): Expense => {
  const { status = "active", ...rest } = extra;
  const totalMinor = sum(Object.values(payers));
  const input = {
    description: "Dinner",
    category: "food",
    date: "2026-10-12",
    currency: "TRY",
    totalMinor,
    payers: Object.entries(payers).map(([memberId, paidMinor]) => ({ memberId, paidMinor })),
    split: Array.isArray(among)
      ? { mode: "equal", parts: among.map((memberId) => ({ memberId, value: 1 })) }
      : { mode: "shares", parts: Object.entries(among).map(([memberId, value]) => ({ memberId, value })) },
    ...rest,
  };
  const checked = checkExpense(input, MEMBERS);
  if (!checked.ok) throw new Error(checked.problems.join(","));
  return { ...checked.input, id: `e${++made}`, status, splits: checked.splits, createdBy: "ann", createdAt: "2026-10-12T10:00:00Z" };
};
const paid = (
  fromMemberId: string,
  toMemberId: string,
  amountMinor: number,
  status: Settlement["status"] = "confirmed",
  currency = "TRY",
): Settlement => ({
  id: `s${++made}`,
  fromMemberId,
  toMemberId,
  currency,
  amountMinor,
  status,
  createdBy: fromMemberId,
  createdAt: "2026-10-12T11:00:00Z",
  confirmedAt: status === "confirmed" ? "2026-10-12T12:00:00Z" : null,
});

/** Applies transfers to nets, as if each were paid: everyone should end at zero. */
const after = (nets: Record<string, number>, transfers: Transfer[]) => {
  const left = { ...nets };
  for (const transfer of transfers) {
    left[transfer.from] = (left[transfer.from] ?? 0) + transfer.amountMinor;
    left[transfer.to] = (left[transfer.to] ?? 0) - transfer.amountMinor;
  }
  return Object.fromEntries(Object.entries(left).filter(([, value]) => value !== 0));
};

describe("payments between people", () => {
  const dinner = expense({ ann: 1200 }, ["ann", "bob", "cy"]); // each owes 400; Ann is owed 800

  it("a confirmed payment brings the payer up and the receiver down, by exactly its amount", () => {
    expect(netsOf([dinner]).TRY).toEqual({ ann: 800, bob: -400, cy: -400 });
    expect(netsOf([dinner], [paid("bob", "ann", 400)]).TRY).toEqual({ ann: 400, bob: 0, cy: -400 });
    // Part of a debt: the rest is still owed.
    expect(netsOf([dinner], [paid("cy", "ann", 150)]).TRY).toEqual({ ann: 650, bob: -400, cy: -250 });
    // Paying more than was owed turns it round: now Ann owes Bob.
    expect(netsOf([dinner], [paid("bob", "ann", 500)]).TRY).toEqual({ ann: 300, bob: 100, cy: -400 });
  });

  it("a proposed or cancelled payment changes nothing", () => {
    const before = netsOf([dinner]);
    expect(netsOf([dinner], [paid("bob", "ann", 400, "proposed"), paid("cy", "ann", 400, "cancelled")])).toEqual(before);
  });

  it("the nets of a currency still add up to zero, and currencies are never mixed", () => {
    const nets = netsOf(
      [dinner, expense({ bob: 9000 }, ["ann", "bob"], { currency: "EUR" })],
      [paid("bob", "ann", 400), paid("ann", "bob", 2000, "confirmed", "EUR"), paid("cy", "bob", 5, "confirmed", "USD")],
    );
    for (const members of Object.values(nets)) expect(sum(Object.values(members))).toBe(0);
    expect(nets.EUR).toEqual({ bob: 2500, ann: -2500 });
    expect(nets.USD).toEqual({ cy: 5, bob: -5 });
  });
});

describe("who should pay whom: simplified", () => {
  it("largest debt to largest credit, until everyone is at zero", () => {
    const nets = { ann: 800, bob: -500, cy: -300 };
    const transfers = simplify(nets, "TRY", PEOPLE);
    expect(transfers).toEqual([
      { from: "bob", to: "ann", currency: "TRY", amountMinor: 500 },
      { from: "cy", to: "ann", currency: "TRY", amountMinor: 300 },
    ]);
    expect(after(nets, transfers)).toEqual({});
  });

  it("fewer transfers than the debts as they arose, when there is a chain", () => {
    // Bob owes Ann 100, Cy owes Bob 100: as it happened, two payments; simplified, Cy pays Ann once.
    const chain = [expense({ ann: 100 }, ["bob"]), expense({ bob: 100 }, ["cy"])];
    expect(pairwise(chain, [], PEOPLE)).toHaveLength(2);
    expect(simplifyAll(netsOf(chain), PEOPLE)).toEqual([{ from: "cy", to: "ann", currency: "TRY", amountMinor: 100 }]);
  });

  it("the same balances always give the same transfers, and ties go by the group's order", () => {
    const nets = { dee: -100, cy: -100, bob: 100, ann: 100 };
    const first = simplify(nets, "TRY", PEOPLE);
    expect(first).toEqual([
      { from: "cy", to: "ann", currency: "TRY", amountMinor: 100 },
      { from: "dee", to: "bob", currency: "TRY", amountMinor: 100 },
    ]);
    expect(simplify(Object.fromEntries(Object.entries(nets).reverse()), "TRY", PEOPLE)).toEqual(first);
  });

  it("nobody owes anything: no transfers", () => {
    expect(simplify({}, "TRY")).toEqual([]);
    expect(simplify({ ann: 0, bob: 0 }, "TRY")).toEqual([]);
    expect(simplifyAll({})).toEqual([]);
  });

  it("each currency is settled on its own", () => {
    const nets = netsOf([expense({ ann: 900 }, ["ann", "bob", "cy"]), expense({ bob: 300 }, ["ann", "bob", "cy"], { currency: "EUR" })]);
    expect(simplifyAll(nets, PEOPLE)).toEqual([
      { from: "ann", to: "bob", currency: "EUR", amountMinor: 100 },
      { from: "cy", to: "bob", currency: "EUR", amountMinor: 100 },
      { from: "bob", to: "ann", currency: "TRY", amountMinor: 300 },
      { from: "cy", to: "ann", currency: "TRY", amountMinor: 300 },
    ]);
  });

  it("whatever the balances, paying the transfers leaves everyone at zero, with at most one fewer transfer than people", () => {
    let seed = 4;
    const next = (limit: number) => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) % limit;
    for (let round = 0; round < 2000; round++) {
      const size = 2 + next(7);
      const ids = Array.from({ length: size }, (_, index) => `m${index}`);
      const nets: Record<string, number> = {};
      let total = 0;
      for (const id of ids.slice(1)) total += nets[id] = next(200_001) - 100_000;
      nets[ids[0]] = -total;
      const transfers = simplify(nets, "TRY", ids);
      expect(after(nets, transfers)).toEqual({});
      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, Object.values(nets).filter((value) => value !== 0).length - 1));
      expect(transfers.every((transfer) => transfer.amountMinor > 0 && transfer.from !== transfer.to)).toBe(true);
    }
  });
});

describe("who owes whom: as it happened", () => {
  it("what a person owes of an expense is owed to whoever paid it, in proportion to what each paid", () => {
    // 1,001 paid 700 by Ann and 301 by Bob, split three ways (334, 334, 333).
    const shared = expense({ ann: 700, bob: 301 }, ["ann", "bob", "cy"]);
    const debts = pairwise([shared], [], PEOPLE);
    expect(debts).toEqual([
      // Bob owes Ann 233 of his share; Ann owes Bob 100 of hers: set against each other, Bob owes Ann 133.
      { from: "bob", to: "ann", currency: "TRY", amountMinor: 133 },
      { from: "cy", to: "ann", currency: "TRY", amountMinor: 233 },
      { from: "cy", to: "bob", currency: "TRY", amountMinor: 100 },
    ]);
    // The pairwise debts say the same as the nets: paying them all leaves everyone at zero.
    expect(after(netsOf([shared]).TRY, debts)).toEqual({});
  });

  it("a payment between two people comes off what one owes the other, and a part payment leaves the rest", () => {
    const dinner = expense({ ann: 1200 }, ["ann", "bob", "cy"]);
    expect(pairwise([dinner], [paid("bob", "ann", 400), paid("cy", "ann", 150), paid("cy", "ann", 999, "proposed")], PEOPLE)).toEqual([
      { from: "cy", to: "ann", currency: "TRY", amountMinor: 250 },
    ]);
  });

  it("cancelled expenses and refunds are handled: a refund shared like the purchase undoes its debts", () => {
    const dinner = expense({ ann: 1200 }, ["ann", "bob", "cy"]);
    const refund = expense({ ann: -1200 }, ["ann", "bob", "cy"]);
    expect(pairwise([dinner, refund], [], PEOPLE)).toEqual([]);
    expect(pairwise([expense({ ann: 1200 }, ["bob"], { status: "cancelled" })], [], PEOPLE)).toEqual([]);
  });

  it("always agrees with the nets, whatever happened", () => {
    let seed = 99;
    const next = (limit: number) => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) % limit;
    for (let round = 0; round < 300; round++) {
      const expenses = Array.from({ length: 1 + next(6) }, () => {
        const payers = Object.fromEntries(PEOPLE.filter(() => next(3) === 0).map((id) => [id, 1 + next(50_000)]));
        if (Object.keys(payers).length === 0) payers[PEOPLE[next(4)]] = 1 + next(50_000);
        const among = Object.fromEntries(PEOPLE.filter(() => next(2) === 0).map((id) => [id, 1 + next(5)]));
        if (Object.keys(among).length === 0) among[PEOPLE[next(4)]] = 1;
        return expense(payers, among);
      });
      const settlements = Array.from({ length: next(4) }, () => {
        const from = PEOPLE[next(4)];
        const to = PEOPLE[(PEOPLE.indexOf(from) + 1 + next(3)) % 4];
        return paid(from, to, 1 + next(20_000), next(4) === 0 ? "proposed" : "confirmed");
      });
      const nets = netsOf(expenses, settlements).TRY ?? {};
      expect(sum(Object.values(nets))).toBe(0);
      expect(after(nets, pairwise(expenses, settlements, PEOPLE))).toEqual({});
      expect(after(nets, simplify(nets, "TRY", PEOPLE))).toEqual({});
    }
  });
});

const rate = (from: string, to: string, value: string, effectiveDate: string, createdAt = `${effectiveDate}T09:00:00Z`): Rate => ({
  id: `r${++made}`,
  from,
  to,
  rate: value,
  effectiveDate,
  createdAt,
});

describe("exchange rates", () => {
  it("are kept as exact text, and what is not a rate is refused", () => {
    expect(["34.25", "34,25", " 0.0292 ", "1", "40.50", "007.5"].map(parseRate)).toEqual(["34.25", "34.25", "0.0292", "1", "40.5", "7.5"]);
    for (const bad of ["", "0", "0.0", "-3", "abc", "1e5", "3.4.5", "1/2", "12345678901234", "0.1234567890123", null, 34.25])
      expect([bad, parseRate(bad)]).toEqual([bad, null]);
  });

  it("the rate for a day is the latest one recorded on or before it: an old expense never moves when a new rate comes", () => {
    const rates = [rate("EUR", "TRY", "34", "2026-09-01"), rate("EUR", "TRY", "36.5", "2026-10-01")];
    expect(rateOn(rates, "EUR", "TRY", "2026-09-15")).toMatchObject({ rate: "34", effectiveDate: "2026-09-01", inverted: false });
    expect(rateOn(rates, "EUR", "TRY", "2026-10-01")).toMatchObject({ rate: "36.5" });
    expect(rateOn(rates, "EUR", "TRY", "2026-12-31")).toMatchObject({ rate: "36.5" });
    // Before any rate was recorded there is no rate: nothing is guessed backwards.
    expect(rateOn(rates, "EUR", "TRY", "2026-08-31")).toBeNull();
    // A later rate changes nothing about September.
    expect(rateOn([...rates, rate("EUR", "TRY", "50", "2026-11-01")], "EUR", "TRY", "2026-09-15")).toMatchObject({ rate: "34" });
    // Two rates for one day: the one recorded last stands.
    expect(
      rateOn(
        [rate("EUR", "TRY", "34", "2026-09-01", "2026-09-01T09:00:00Z"), rate("EUR", "TRY", "35", "2026-09-01", "2026-09-01T18:00:00Z")],
        "EUR",
        "TRY",
        "2026-09-02",
      ),
    ).toMatchObject({ rate: "35" });
  });

  it("a rate recorded the other way round is turned over, and says so; a currency into itself is one", () => {
    const rates = [rate("TRY", "EUR", "0.025", "2026-10-01")];
    expect(rateOn(rates, "EUR", "TRY", "2026-10-05")).toEqual({ rate: "40", effectiveDate: "2026-10-01", inverted: true });
    expect(rateOn(rates, "USD", "TRY", "2026-10-05")).toBeNull();
    expect(rateOn([], "TRY", "TRY", "2026-10-05")).toEqual({ rate: "1", effectiveDate: "2026-10-05", inverted: false });
  });

  it("converting is exact arithmetic on the currencies' own units, rounded the same way every time", () => {
    expect(convert(10_000, "EUR", "TRY", "36.5")).toBe(365_000); // 100.00 EUR → 3,650.00 TRY
    expect(convert(1, "EUR", "TRY", "36.555")).toBe(37); // 0.01 EUR → 0.36555 TRY → 0.37
    expect(convert(1000, "JPY", "TRY", "0.25")).toBe(25_000); // 1000 yen → 250.00 TRY
    expect(convert(25_000, "TRY", "JPY", "4")).toBe(1000);
    expect(convert(1250, "KWD", "USD", "3.25")).toBe(406); // 1.250 dinar → 4.0625 → 4.06
    expect(convert(-10_000, "EUR", "TRY", "36.5")).toBe(-365_000);
    // Halves go away from zero, both ways.
    expect([convert(1, "EUR", "TRY", "0.5"), convert(-1, "EUR", "TRY", "0.5")]).toEqual([1, -1]);
    expect(convert(123, "TRY", "TRY", "999")).toBe(123);
    expect(() => convert(10_000_000_000_000, "EUR", "TRY", "999999")).toThrow(RangeError);
  });
});

describe("what a group spent", () => {
  const rates = [rate("EUR", "TRY", "36", "2026-10-01")];
  const spent = [
    expense({ ann: 120_000 }, ["ann", "bob"], { date: "2026-10-02", category: "groceries" }),
    expense({ bob: 30_000 }, ["ann", "bob", "cy"], { date: "2026-10-02", category: "food" }),
    expense({ ann: 10_000 }, ["ann", "bob"], { date: "2026-10-05", category: "lodging", currency: "EUR" }), // 100.00 EUR → 3,600.00 TRY
    expense({ ann: -20_000 }, ["ann", "bob"], { date: "2026-10-06", category: "groceries" }), // a refund
    expense({ ann: 999_999 }, ["ann"], { date: "2026-10-07", status: "cancelled" }),
    expense({ cy: 5000 }, ["cy"], { date: "2026-09-30", category: "fun" }), // last month
    expense({ cy: 700 }, ["cy", "dee"], { date: "2026-10-08", category: "transport", currency: "USD" }), // no rate for dollars
  ];

  it("totals, average, categories, people and days, in the group's currency, for a period", () => {
    const october = summarise(spent, "TRY", rates, monthOf("2026-10-12"));
    expect([october.totalMinor, october.count, october.averageMinor]).toEqual([490_000, 4, 122_500]);
    expect(october.byCategory).toEqual([
      { category: "lodging", totalMinor: 360_000, share: 7347 },
      { category: "groceries", totalMinor: 100_000, share: 2041 },
      { category: "food", totalMinor: 30_000, share: 612 },
    ]);
    expect(october.byMember).toEqual([
      { memberId: "ann", owedMinor: 240_000, share: 4898 },
      { memberId: "bob", owedMinor: 240_000, share: 4898 },
      { memberId: "cy", owedMinor: 10_000, share: 204 },
    ]);
    expect(october.byDay).toEqual([
      { day: "2026-10-02", totalMinor: 150_000 },
      { day: "2026-10-05", totalMinor: 360_000 },
      { day: "2026-10-06", totalMinor: -20_000 },
    ]);
    expect(sum(october.byCategory.map((row) => row.totalMinor))).toBe(october.totalMinor);
    expect(sum(october.byMember.map((row) => row.owedMinor))).toBe(october.totalMinor);
  });

  it("what cannot be converted is left out and counted, never converted at a made-up rate", () => {
    const october = summarise(spent, "TRY", rates, monthOf("2026-10-12"));
    expect(october.leftOut).toEqual([{ currency: "USD", count: 1, totalMinor: 700 }]);
    expect(october.native).toEqual({ TRY: 130_000, EUR: 10_000, USD: 700 });
    // With no rates at all only the group's own currency is in the figures.
    const bare = summarise(spent, "TRY", [], monthOf("2026-10-12"));
    expect([bare.totalMinor, bare.count, bare.leftOut.map((row) => row.currency)]).toEqual([130_000, 3, ["EUR", "USD"]]);
  });

  it("a new rate for a later day does not move last week's figures", () => {
    const before = summarise(spent, "TRY", rates, monthOf("2026-10-12"));
    const after2 = summarise(spent, "TRY", [...rates, rate("EUR", "TRY", "50", "2026-10-10")], monthOf("2026-10-12"));
    expect(after2).toEqual(before);
  });

  it("periods: a month, the month before, everything", () => {
    expect(monthOf("2026-10-12")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthOf("2026-10-12", -1)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthOf("2027-01-05", -1)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(monthOf("2028-02-29")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(summarise(spent, "TRY", rates, monthOf("2026-10-12", -1))).toMatchObject({ totalMinor: 5000, count: 1 });
    expect(summarise(spent, "TRY", rates, null)).toMatchObject({ totalMinor: 495_000, count: 5 });
    expect(summarise([], "TRY", rates, null)).toMatchObject({ totalMinor: 0, count: 0, averageMinor: null, byCategory: [], byDay: [] });
  });
});

describe("the spreadsheet file", () => {
  const names = new Map([
    ["ann", "Ann"],
    ["bob", 'Bob "the cook", Jr'],
  ]);
  const rows = [
    expense({ ann: 120_050 }, ["ann", "bob"], { description: "Dinner, with wine", date: "2026-10-02" }),
    expense({ bob: 30_000 }, ["ann", "bob"], { description: "=SUM(A1:A9)", category: null, status: "cancelled" }),
  ];
  const csv = toCsv(rows, names, ["Date", "What", "Category", "Amount", "Currency", "State", "Paid", "Shares"], toDecimalString);

  it("one row per expense, exact amounts, awkward text quoted", () => {
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("Date,What,Category,Amount,Currency,State,Paid,Shares");
    expect(lines[1]).toBe(
      '2026-10-02,"Dinner, with wine",food,1200.50,TRY,active,Ann: 1200.50,"Ann: 600.25; Bob ""the cook"", Jr: 600.25"',
    );
    expect(lines).toHaveLength(4);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("a cell that a spreadsheet would run as a formula is made plain text", () => {
    expect(csv).toContain("'=SUM(A1:A9)");
    expect(
      toCsv(
        [expense({ ann: 100 }, ["ann"], { description: "+1 hour parking" }), expense({ ann: 100 }, ["ann"], { description: "@home" })],
        names,
        ["a"],
        toDecimalString,
      ),
    ).toMatch(/'\+1 hour parking[\s\S]*'@home/);
  });
});
