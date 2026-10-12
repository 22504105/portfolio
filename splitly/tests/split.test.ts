import { describe, expect, it } from "vitest";
import { netOfMember, netsOf, spentOf } from "@/lib/balances/net";
import type { Expense, ExpenseInput } from "@/lib/domain/types";
import { buildSplits, checkExpense } from "@/lib/split/expense";

const MEMBERS = new Set(["ann", "bob", "cy"]);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const base: ExpenseInput = {
  description: "Dinner",
  category: "food",
  date: "2026-10-12",
  currency: "TRY",
  totalMinor: 1000,
  payers: [{ memberId: "ann", paidMinor: 1000 }],
  split: {
    mode: "equal",
    parts: [
      { memberId: "ann", value: 1 },
      { memberId: "bob", value: 1 },
      { memberId: "cy", value: 1 },
    ],
  },
};

const problems = (input: unknown) => {
  const result = checkExpense(input, MEMBERS);
  return result.ok ? [] : result.problems.sort();
};

describe("dividing an expense", () => {
  it("equally: leftover units go to the first people listed", () => {
    expect(buildSplits(1000, base.split)).toEqual([
      { memberId: "ann", owedMinor: 334 },
      { memberId: "bob", owedMinor: 333 },
      { memberId: "cy", owedMinor: 333 },
    ]);
  });

  it("by exact amounts: accepted only when they add up, never adjusted", () => {
    const exact = (values: number[]) =>
      buildSplits(1000, { mode: "exact", parts: [...MEMBERS].map((memberId, index) => ({ memberId, value: values[index] })) });
    expect(exact([500, 300, 200])?.map((part) => part.owedMinor)).toEqual([500, 300, 200]);
    expect(exact([1000, 0, 0])?.map((part) => part.owedMinor)).toEqual([1000, 0, 0]);
    expect(exact([500, 300, 199])).toBeNull();
    expect(exact([1200, -200, 0])).toBeNull();
  });

  it("by percentages: only when they make a hundred", () => {
    const percent = (values: number[]) =>
      buildSplits(1001, { mode: "percent", parts: [...MEMBERS].map((memberId, index) => ({ memberId, value: values[index] })) });
    expect(percent([5000, 2500, 2500])?.map((part) => part.owedMinor)).toEqual([501, 250, 250]);
    expect(percent([5000, 2500, 2400])).toBeNull();
    expect(percent([10_001, 0, -1])).toBeNull();
  });

  it("by shares", () => {
    const shares = buildSplits(1000, {
      mode: "shares",
      parts: [
        { memberId: "ann", value: 2 },
        { memberId: "bob", value: 1 },
      ],
    });
    expect(shares).toEqual([
      { memberId: "ann", owedMinor: 667 },
      { memberId: "bob", owedMinor: 333 },
    ]);
    expect(
      buildSplits(1000, {
        mode: "shares",
        parts: [
          { memberId: "ann", value: 0 },
          { memberId: "bob", value: 0 },
        ],
      }),
    ).toBeNull();
  });

  it("always adds up to the total, whatever the mode", () => {
    for (const total of [1, 7, 999, 1000, 100_003, -1001]) {
      for (const split of [
        base.split,
        {
          mode: "percent" as const,
          parts: [
            { memberId: "ann", value: 3333 },
            { memberId: "bob", value: 3333 },
            { memberId: "cy", value: 3334 },
          ],
        },
        {
          mode: "shares" as const,
          parts: [
            { memberId: "ann", value: 5 },
            { memberId: "bob", value: 3 },
            { memberId: "cy", value: 1 },
          ],
        },
      ]) {
        expect(sum(buildSplits(total, split)!.map((part) => part.owedMinor))).toBe(total);
      }
    }
  });
});

describe("checking an expense before it is stored", () => {
  it("accepts a good one and works the shares out itself", () => {
    const result = checkExpense({ ...base, description: "  Dinner  ", splits: [{ memberId: "ann", owedMinor: 1 }] }, MEMBERS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.description).toBe("Dinner");
    // Shares sent by a client are ignored: they are computed here.
    expect(result.splits.map((part) => part.owedMinor)).toEqual([334, 333, 333]);
    expect("splits" in result.input).toBe(false);
  });

  it("accepts several payers whose amounts add up", () => {
    expect(
      problems({
        ...base,
        payers: [
          { memberId: "ann", paidMinor: 600 },
          { memberId: "bob", paidMinor: 400 },
        ],
      }),
    ).toEqual([]);
  });

  it("says by how much the payers are off", () => {
    const result = checkExpense(
      {
        ...base,
        payers: [
          { memberId: "ann", paidMinor: 600 },
          { memberId: "bob", paidMinor: 300 },
        ],
      },
      MEMBERS,
    );
    expect(result).toMatchObject({ ok: false, problems: ["payers_sum"], differences: { payers_sum: 100 } });
  });

  it("says by how much exact shares and percentages are off", () => {
    const exact = checkExpense(
      {
        ...base,
        split: {
          mode: "exact",
          parts: [
            { memberId: "ann", value: 500 },
            { memberId: "bob", value: 450 },
          ],
        },
      },
      MEMBERS,
    );
    expect(exact).toMatchObject({ ok: false, problems: ["split_sum"], differences: { split_sum: 50 } });
    const percent = checkExpense(
      {
        ...base,
        split: {
          mode: "percent",
          parts: [
            { memberId: "ann", value: 6000 },
            { memberId: "bob", value: 3000 },
          ],
        },
      },
      MEMBERS,
    );
    expect(percent).toMatchObject({ ok: false, problems: ["percent_sum"], differences: { percent_sum: 1000 } });
  });

  it("refuses people who are not in the group, as payers or as participants", () => {
    expect(problems({ ...base, payers: [{ memberId: "mallory", paidMinor: 1000 }] })).toEqual(["payer_unknown"]);
    expect(
      problems({
        ...base,
        split: {
          mode: "equal",
          parts: [
            { memberId: "ann", value: 1 },
            { memberId: "mallory", value: 1 },
          ],
        },
      }),
    ).toEqual(["participant_unknown"]);
  });

  it("refuses the same person twice", () => {
    expect(
      problems({
        ...base,
        payers: [
          { memberId: "ann", paidMinor: 500 },
          { memberId: "ann", paidMinor: 500 },
        ],
      }),
    ).toEqual(["payer_repeated"]);
    expect(
      problems({
        ...base,
        split: {
          mode: "equal",
          parts: [
            { memberId: "ann", value: 1 },
            { memberId: "ann", value: 1 },
          ],
        },
      }),
    ).toEqual(["participant_repeated"]);
  });

  it("refuses what is missing or malformed, and says which", () => {
    expect(problems({ ...base, description: "   " })).toEqual(["description"]);
    expect(problems({ ...base, description: "x".repeat(201) })).toEqual(["description"]);
    expect(problems({ ...base, date: "2026-02-30" })).toEqual(["date"]);
    expect(problems({ ...base, date: "12.10.2026" })).toEqual(["date"]);
    expect(problems({ ...base, currency: "lira" })).toEqual(["currency"]);
    expect(problems({ ...base, category: "weapons" })).toEqual(["category"]);
    expect(problems({ ...base, totalMinor: 0 })).toEqual(["total"]);
    expect(problems({ ...base, totalMinor: 10.5 })).toContain("total");
    expect(problems({ ...base, totalMinor: "1000" })).toContain("total");
    expect(problems({ ...base, payers: [] })).toEqual(["no_payers"]);
    expect(problems({ ...base, split: { mode: "equal", parts: [] } })).toEqual(["no_participants"]);
    expect(problems({ ...base, split: { mode: "thirds", parts: base.split.parts } })).toEqual(["split_values"]);
  });

  it("survives anything at all being sent", () => {
    for (const hostile of [
      null,
      undefined,
      42,
      "expense",
      [],
      { payers: "ann", split: 7 },
      { split: { parts: [null, 5, {}] }, payers: [null] },
    ]) {
      expect(checkExpense(hostile, MEMBERS).ok).toBe(false);
    }
  });

  it("takes a refund: a negative total, paid back to the payer, shared like the purchase", () => {
    const refund = checkExpense({ ...base, totalMinor: -1000, payers: [{ memberId: "ann", paidMinor: -1000 }] }, MEMBERS);
    expect(refund.ok && refund.splits.map((part) => part.owedMinor)).toEqual([-334, -333, -333]);
    // A refund cannot be "paid" with a positive amount.
    expect(problems({ ...base, totalMinor: -1000, payers: [{ memberId: "ann", paidMinor: 1000 }] })).toContain("payer_sign");
  });

  it("allows no category", () => {
    for (const category of [null, undefined, ""])
      expect(checkExpense({ ...base, category }, MEMBERS)).toMatchObject({ ok: true, input: { category: null } });
  });
});

describe("where everyone stands", () => {
  const stored = (id: string, input: ExpenseInput, status: Expense["status"] = "active"): Expense => {
    const checked = checkExpense(input, MEMBERS);
    if (!checked.ok) throw new Error(checked.problems.join(","));
    return { ...checked.input, id, status, splits: checked.splits, createdBy: "ann", createdAt: "2026-10-12T10:00:00Z" };
  };

  const expenses = [
    stored("e1", base), // Ann paid 1000, split 334 / 333 / 333
    stored("e2", {
      ...base,
      totalMinor: 600,
      payers: [{ memberId: "bob", paidMinor: 600 }],
      split: {
        mode: "equal",
        parts: [
          { memberId: "ann", value: 1 },
          { memberId: "bob", value: 1 },
        ],
      },
    }),
    stored("e3", { ...base, currency: "EUR", totalMinor: 900, payers: [{ memberId: "cy", paidMinor: 900 }] }),
    stored("e4", { ...base, totalMinor: 5000, payers: [{ memberId: "ann", paidMinor: 5000 }] }, "cancelled"),
    stored("e5", { ...base, totalMinor: 7000, payers: [{ memberId: "ann", paidMinor: 7000 }] }, "replaced"),
  ];

  it("a member's net is what they paid minus what they owe, per currency", () => {
    const nets = netsOf(expenses);
    // TRY: Ann paid 1000, owes 334 + 300. Bob paid 600, owes 333 + 300. Cy paid 0, owes 333.
    expect(nets.TRY).toEqual({ ann: 366, bob: -33, cy: -333 });
    // EUR: Cy paid 900, everyone owes 300.
    expect(nets.EUR).toEqual({ cy: 600, ann: -300, bob: -300 });
  });

  it("the nets of a currency add up to zero, always", () => {
    for (const members of Object.values(netsOf(expenses))) expect(sum(Object.values(members))).toBe(0);
  });

  it("cancelled and replaced expenses count for nothing", () => {
    expect(netsOf(expenses.filter((expense) => expense.status !== "active"))).toEqual({});
    expect(spentOf(expenses)).toEqual({ TRY: 1600, EUR: 900 });
  });

  it("currencies are never mixed into one figure", () => {
    expect(netOfMember(netsOf(expenses), "ann")).toEqual({ TRY: 366, EUR: -300 });
    expect(netOfMember(netsOf(expenses), "nobody")).toEqual({});
    expect(netOfMember(netsOf(expenses), undefined)).toEqual({});
  });

  it("a refund undoes exactly what the purchase did", () => {
    const refund = stored("r1", { ...base, totalMinor: -1000, payers: [{ memberId: "ann", paidMinor: -1000 }] });
    const nets = netsOf([expenses[0], refund]);
    expect(Object.values(nets.TRY).every((net) => net === 0)).toBe(true);
  });
});
