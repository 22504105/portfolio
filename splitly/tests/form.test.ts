import { describe, expect, it } from "vitest";
import type { Expense, Member } from "@/lib/domain/types";
import { checkExpense } from "@/lib/split/expense";
import { compose, emptyForm, formOf, parsePercent, today } from "@/lib/split/form";

const member = (id: string, extra: Partial<Member> = {}): Member => ({
  id,
  name: id,
  guest: false,
  role: "member",
  self: false,
  removedAt: null,
  ...extra,
});
const MEMBERS = [
  member("ann", { self: true, role: "owner" }),
  member("bob"),
  member("cy"),
  member("dan", { removedAt: "2026-10-01T00:00:00Z" }),
];
const CURRENT = new Set(["ann", "bob", "cy"]);
const NOW = new Date(2026, 9, 12, 23, 30);

const filled = (changes: Partial<ReturnType<typeof emptyForm>> = {}) => ({
  ...emptyForm(MEMBERS, "TRY", NOW),
  description: "Dinner",
  amount: "1 000,00",
  ...changes,
});
const check = (form: ReturnType<typeof emptyForm>) => checkExpense(compose(form, MEMBERS), CURRENT);

describe("the expense form", () => {
  it("starts with today, the group's currency, the viewer as payer and everyone current taking part", () => {
    const form = emptyForm(MEMBERS, "EUR", NOW);
    expect([form.date, form.currency, form.payerId, form.mode, form.included]).toEqual([
      "2026-10-12",
      "EUR",
      "ann",
      "equal",
      { ann: true, bob: true, cy: true },
    ]);
    // The day is the visitor's own, late in the evening too.
    expect(today(new Date(2026, 0, 5, 0, 10))).toBe("2026-01-05");
  });

  it("becomes a balanced expense, split equally between those ticked", () => {
    const result = check(filled({ included: { ann: true, bob: false, cy: true } }));
    expect(result.ok && [result.input.totalMinor, result.input.payers, result.splits]).toEqual([
      100_000,
      [{ memberId: "ann", paidMinor: 100_000 }],
      [
        { memberId: "ann", owedMinor: 50_000 },
        { memberId: "cy", owedMinor: 50_000 },
      ],
    ]);
  });

  it("takes amounts, percentages and shares as typed", () => {
    const exact = check(filled({ mode: "exact", values: { exact: { ann: "500", bob: "300,50", cy: "199.50" }, percent: {}, shares: {} } }));
    expect(exact.ok && exact.splits.map((split) => split.owedMinor)).toEqual([50_000, 30_050, 19_950]);
    const percent = check(
      filled({ mode: "percent", values: { exact: {}, percent: { ann: "50", bob: "33,33", cy: "16.67%" }, shares: {} } }),
    );
    expect(percent.ok && percent.splits.map((split) => split.owedMinor)).toEqual([50_000, 33_330, 16_670]);
    const shares = check(filled({ mode: "shares", values: { exact: {}, percent: {}, shares: { ann: "2", bob: "1", cy: "1" } } }));
    expect(shares.ok && shares.splits.map((split) => split.owedMinor)).toEqual([50_000, 25_000, 25_000]);
  });

  it("several payers: those with an amount typed are the payers", () => {
    const good = check(filled({ several: true, paid: { ann: "600", bob: "400", cy: "  " } }));
    expect(good.ok && good.input.payers).toEqual([
      { memberId: "ann", paidMinor: 60_000 },
      { memberId: "bob", paidMinor: 40_000 },
    ]);
    expect(check(filled({ several: true, paid: { ann: "600" } }))).toMatchObject({
      ok: false,
      problems: ["payers_sum"],
      differences: { payers_sum: 40_000 },
    });
    expect(check(filled({ several: true, paid: {} }))).toMatchObject({ ok: false, problems: ["no_payers"] });
  });

  it("a refund is ticked, not typed with a minus, and comes out negative throughout", () => {
    const refund = check(
      filled({ refund: true, mode: "exact", values: { exact: { ann: "1000", bob: "0", cy: "0" }, percent: {}, shares: {} } }),
    );
    expect(refund.ok && [refund.input.totalMinor, refund.input.payers[0].paidMinor, refund.splits.map((split) => split.owedMinor)]).toEqual(
      [-100_000, -100_000, [-100_000, 0, 0]],
    );
    expect(check(filled({ amount: "-1000" }))).toMatchObject({ ok: false, problems: expect.arrayContaining(["total"]) });
  });

  it("never turns what was typed into a different number: what is not a number is refused", () => {
    for (const amount of ["", "abc", "12,345", "1.2.3", "10,999", "0"])
      expect([amount, check(filled({ amount })).ok]).toEqual([amount, false]);
    expect(check(filled({ mode: "exact", values: { exact: { ann: "500", bob: "", cy: "500" }, percent: {}, shares: {} } }))).toMatchObject({
      ok: false,
      problems: ["split_values"],
    });
    expect(check(filled({ mode: "shares", values: { exact: {}, percent: {}, shares: { ann: "1.5", bob: "1", cy: "1" } } }))).toMatchObject({
      ok: false,
      problems: ["split_values"],
    });
    expect(check(filled({ included: { ann: false, bob: false, cy: false } }))).toMatchObject({ ok: false, problems: ["no_participants"] });
    expect(check(filled({ description: "  " }))).toMatchObject({ ok: false, problems: ["description"] });
  });

  it("reads percentages strictly", () => {
    expect(["25", "33,33", "12.5", " 40 % ", "100", "0"].map(parsePercent)).toEqual([2500, 3333, 1250, 4000, 10_000, 0]);
    for (const bad of ["", "abc", "1,234", "-5", "1e2", "12.345"]) expect([bad, Number.isNaN(parsePercent(bad))]).toEqual([bad, true]);
  });

  it("keeps what was typed in each mode when the mode is switched", () => {
    const form = filled({
      mode: "percent",
      values: { exact: { ann: "700" }, percent: { ann: "50", bob: "25", cy: "25" }, shares: { ann: "3" } },
    });
    expect(compose({ ...form, mode: "exact" }, MEMBERS).split.parts[0].value).toBe(70_000);
    expect(compose({ ...form, mode: "shares" }, MEMBERS).split.parts[0].value).toBe(3);
    expect(compose(form, MEMBERS).split.parts.map((part) => part.value)).toEqual([5000, 2500, 2500]);
  });
});

describe("changing a stored expense", () => {
  const stored = (input: ReturnType<typeof filled>): Expense => {
    const result = check(input);
    if (!result.ok) throw new Error(result.problems.join(","));
    return { ...result.input, id: "e1", status: "active", splits: result.splits, createdBy: "ann", createdAt: "2026-10-12T10:00:00Z" };
  };

  it("opens it the way it was entered, and saving it unchanged gives the same expense", () => {
    for (const input of [
      filled(),
      filled({ amount: "1000.05", category: "food", included: { ann: true, bob: true, cy: false } }),
      filled({ mode: "exact", values: { exact: { ann: "500", bob: "300,50", cy: "199,50" }, percent: {}, shares: {} } }),
      filled({ mode: "percent", values: { exact: {}, percent: { ann: "50", bob: "33,33", cy: "16,67" }, shares: {} } }),
      filled({ mode: "shares", values: { exact: {}, percent: {}, shares: { ann: "2", bob: "1", cy: "0" } } }),
      filled({ several: true, paid: { ann: "600", bob: "400" }, payerId: "bob" }),
      filled({ refund: true, payerId: "cy" }),
      filled({ currency: "JPY", amount: "1500" }),
      filled({ currency: "KWD", amount: "12,345" }),
    ]) {
      const expense = stored(input);
      const again = check(formOf(expense, MEMBERS));
      expect(again.ok && [again.input, again.splits]).toEqual(
        [
          { ...expense, id: undefined, status: undefined, splits: undefined, createdBy: undefined, createdAt: undefined },
          expense.splits,
        ].map((value) => JSON.parse(JSON.stringify(value))),
      );
    }
  });

  it("drops people who have left since, and then says what no longer adds up", () => {
    const expense: Expense = {
      ...stored(filled({ mode: "exact", values: { exact: { ann: "400", bob: "300", cy: "300" }, percent: {}, shares: {} } })),
    };
    const without = MEMBERS.map((person) => (person.id === "cy" ? { ...person, removedAt: "2026-10-12T00:00:00Z" } : person));
    const form = formOf(expense, without);
    expect(form.included).toEqual({ ann: true, bob: true });
    expect(checkExpense(compose(form, without), new Set(["ann", "bob"]))).toMatchObject({
      ok: false,
      problems: ["split_sum"],
      differences: { split_sum: 30_000 },
    });
  });
});
