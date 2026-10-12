import type { Category, Expense, ExpenseInput, Member, SplitMode } from "@/lib/domain/types";
import { buildSplits } from "@/lib/split/expense";
import type { DemoGroup } from "./demo";

// The invented groups a demo starts with: a weekend away in one currency and
// a shared flat in another, with every kind of expense the app can hold, so
// that each screen has something real-looking to show. All of it is made up.

const TEXT = {
  en: {
    you: "Alex",
    trip: "Istanbul weekend",
    flat: "Flat in Moda",
    kerem: "Kerem",
    dinner: "Dinner in Karaköy",
    ferry: "Bosphorus ferry",
    museum: "Museum tickets",
    taxi: "Taxi from the airport",
    baklava: "Baklava and tea",
    deposit: "Hotel deposit (entered twice)",
    refund: "Refund: one museum ticket",
    rent: "Rent, October",
    internet: "Internet",
    groceries: "Groceries",
    supplies: "Cleaning supplies",
  },
  ru: {
    you: "Алексей",
    trip: "Выходные в Стамбуле",
    flat: "Квартира в Моде",
    kerem: "Керем",
    dinner: "Ужин в Каракёе",
    ferry: "Паром по Босфору",
    museum: "Билеты в музей",
    taxi: "Такси из аэропорта",
    baklava: "Пахлава и чай",
    deposit: "Залог за отель (внесён дважды)",
    refund: "Возврат: один билет в музей",
    rent: "Аренда, октябрь",
    internet: "Интернет",
    groceries: "Продукты",
    supplies: "Бытовая химия",
  },
} as const;

const member = (id: string, name: string, extra: Partial<Member> = {}): Member => ({
  id,
  name,
  guest: false,
  role: "member",
  self: false,
  removedAt: null,
  ...extra,
});

export function seedGroups(locale: string, now = new Date()): DemoGroup[] {
  const t = TEXT[locale === "ru" ? "ru" : "en"];
  const day = (ago: number) => new Date(now.getTime() - ago * 86_400_000).toISOString().slice(0, 10);
  let order = 0;

  const expense = (
    id: string,
    description: string,
    category: Category,
    ago: number,
    currency: string,
    totalMinor: number,
    payers: [string, number][],
    mode: SplitMode,
    parts: [string, number][],
    status: Expense["status"] = "active",
  ): Expense => {
    const input: ExpenseInput = {
      description,
      category,
      date: day(ago),
      currency,
      totalMinor,
      payers: payers.map(([memberId, paidMinor]) => ({ memberId, paidMinor })),
      split: { mode, parts: parts.map(([memberId, value]) => ({ memberId, value })) },
    };
    const splits = buildSplits(totalMinor, input.split);
    if (!splits) throw new Error(`Demo expense does not add up: ${id}`);
    // Entered a minute apart, so that expenses of one day keep a fixed order.
    const createdAt = new Date(now.getTime() - ago * 86_400_000 - order++ * 60_000).toISOString();
    return { ...input, id, status, splits, createdBy: payers[0][0], createdAt };
  };

  const everyone = (ids: string[]): [string, number][] => ids.map((id) => [id, 1]);
  const trip = ["t-you", "t-deniz", "t-mira", "t-kerem"];
  const flat = ["f-you", "f-nika", "f-sam"];

  return [
    {
      id: "demo-istanbul",
      name: t.trip,
      baseCurrency: "TRY",
      archivedAt: null,
      members: [
        member("t-you", t.you, { self: true, role: "owner" }),
        member("t-deniz", "Deniz", { role: "admin" }),
        member("t-mira", "Mira"),
        member("t-kerem", t.kerem, { guest: true }),
      ],
      keys: {},
      expenses: [
        expense("t-e1", t.baklava, "food", 0, "TRY", 42_000, [["t-mira", 42_000]], "exact", [
          ["t-you", 12_000],
          ["t-deniz", 9_000],
          ["t-mira", 9_000],
          ["t-kerem", 12_000],
        ]),
        expense("t-e2", t.refund, "fun", 0, "TRY", -45_000, [["t-mira", -45_000]], "equal", everyone(["t-kerem"])),
        expense("t-e3", t.dinner, "food", 1, "TRY", 248_000, [["t-you", 248_000]], "equal", everyone(trip)),
        expense("t-e4", t.museum, "fun", 1, "TRY", 180_000, [["t-mira", 180_000]], "equal", everyone(trip)),
        expense("t-e5", t.deposit, "lodging", 2, "TRY", 300_000, [["t-you", 300_000]], "equal", everyone(trip), "cancelled"),
        expense("t-e6", t.ferry, "transport", 2, "TRY", 36_050, [["t-deniz", 36_050]], "equal", everyone(trip)),
        expense(
          "t-e7",
          t.taxi,
          "transport",
          3,
          "TRY",
          95_000,
          [
            ["t-you", 50_000],
            ["t-deniz", 45_000],
          ],
          "shares",
          [
            ["t-you", 1],
            ["t-deniz", 1],
            ["t-mira", 2],
          ],
        ),
      ],
    },
    {
      id: "demo-flat",
      name: t.flat,
      baseCurrency: "EUR",
      archivedAt: null,
      members: [member("f-you", t.you, { self: true, role: "owner" }), member("f-nika", "Nika"), member("f-sam", "Sam")],
      keys: {},
      expenses: [
        expense("f-e1", t.supplies, "groceries", 1, "TRY", 64_000, [["f-you", 64_000]], "equal", everyone(flat)),
        expense("f-e2", t.groceries, "groceries", 2, "EUR", 8_640, [["f-sam", 8_640]], "equal", everyone(flat)),
        expense("f-e3", t.internet, "other", 5, "EUR", 3_500, [["f-you", 3_500]], "equal", everyone(flat)),
        expense("f-e4", t.rent, "lodging", 11, "EUR", 120_000, [["f-nika", 120_000]], "percent", [
          ["f-you", 4000],
          ["f-nika", 3000],
          ["f-sam", 3000],
        ]),
      ],
    },
  ];
}
