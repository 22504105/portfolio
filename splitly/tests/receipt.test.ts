import { describe, expect, it } from "vitest";
import { allocateLines, buildReceiptExpense, totalsByMember } from "@/lib/receipt/build";
import { GLOSSARY_SIZE, translateLabel } from "@/lib/receipt/glossary";
import { enlargedSize, evenOut } from "@/lib/receipt/image";
import { linesFromTsv } from "@/lib/receipt/ocr";
import { likelyDuplicates, mergeReadings, parseReceipt, reconcile } from "@/lib/receipt/parse";
import type { ReceiptLine } from "@/lib/receipt/types";

const text = (receipt: string) => receipt.split("\n").map((line) => ({ text: line, confidence: 90 }));
const brief = (parsed: ReturnType<typeof parseReceipt>) =>
  parsed.lines.map((line) => [line.kind, line.label, line.quantity, line.lineTotalMinor]);

// The concept's own receipt.
const MIGROS = `MIGROS
ISTANBUL
12.07.2024 15:32
FIS NO: 0042
SÜT 1L                 80,00
TAVUK GÖĞSÜ           360,00
EKMEK                  40,00
PEYNIR                240,00
DETERJAN              480,00
TOPKDV                 96,12
TOPLAM              1.200,00
KREDI KARTI         1.200,00
TESEKKUR EDERIZ`;

describe("reading a receipt's text", () => {
  it("the concept's Turkish receipt: five things bought, the total, tax as already included", () => {
    const parsed = parseReceipt(text(MIGROS), "TRY");
    expect(brief(parsed)).toEqual([
      ["item", "SÜT 1L", "1", 8000],
      ["item", "TAVUK GÖĞSÜ", "1", 36000],
      ["item", "EKMEK", "1", 4000],
      ["item", "PEYNIR", "1", 24000],
      ["item", "DETERJAN", "1", 48000],
    ]);
    expect([parsed.printedTotalMinor, parsed.includedTaxMinor, parsed.unmatched]).toEqual([120_000, 9612, []]);
    expect(reconcile(parsed.lines, parsed.printedTotalMinor)).toEqual({ sumMinor: 120_000, differenceMinor: 0 });
  });

  it("an English restaurant bill: quantities, a discount, a service charge, both decimal styles", () => {
    const parsed = parseReceipt(
      text(`THE HARBOUR GRILL
Table 12   Date: 03/10/2026
2 x Lentil soup            9.00
Grilled salmon            24.50
3 X 4.00
Cola                      12.00
House wine 1,234.50
Discount 10%              -4.55
Service charge 12.5%       5.12
Subtotal                1,280.00
VAT 20% incl.            213.43
TOTAL                 $1,280.57
Cash                   1,300.00
Change                    19.43`),
      "USD",
    );
    expect(brief(parsed)).toEqual([
      ["item", "Lentil soup", "2", 900],
      ["item", "Grilled salmon", "1", 2450],
      ["item", "Cola", "3", 1200],
      ["item", "House wine", "1", 123_450],
      ["discount", "Discount 10%", "1", -455],
      ["service", "Service charge 12.5%", "1", 512],
    ]);
    expect(parsed.printedTotalMinor).toBe(128_057);
    expect(reconcile(parsed.lines, parsed.printedTotalMinor).differenceMinor).toBe(0);
  });

  it("a Russian shop receipt: weights, a discount row, and the fiscal lines left out", () => {
    const parsed = parseReceipt(
      text(`ООО "ПРОДУКТЫ"
ИНН 7700000000
Чек № 118   Дата 05.10.2026 18:04
Молоко 3,2% 1л            89,90
Хлеб бородинский          54,00
Помидоры
0,485 кг x 240,00        116,40
Сыр российский           312,50
Скидка по карте          -30,00
ИТОГ                     542,80
НДС 10%                   49,35
Безналичными             542,80
ФН 9999078900001234  ФД 4521`),
      "RUB",
    );
    expect(brief(parsed)).toEqual([
      ["item", "Молоко 3,2% 1л", "1", 8990],
      ["item", "Хлеб бородинский", "1", 5400],
      ["item", "Помидоры", "0.485", 11_640],
      ["item", "Сыр российский", "1", 31_250],
      ["discount", "Скидка по карте", "1", -3000],
    ]);
    expect([parsed.printedTotalMinor, parsed.includedTaxMinor, reconcile(parsed.lines, parsed.printedTotalMinor).differenceMinor]).toEqual([
      54_280, 4935, 0,
    ]);
  });

  it("never invents a price: a name without an amount is handed back as text, and a mismatch is reported, not hidden", () => {
    const parsed = parseReceipt(text(`MARKET\nEKMEK 40,00\nZEYTIN SIYAH\nPEYNIR 24O,OO\nSU 15,00\nTOPLAM 295,00`), "TRY");
    expect(brief(parsed)).toEqual([
      ["item", "EKMEK", "1", 4000],
      ["item", "SU", "1", 1500],
    ]);
    expect(parsed.unmatched).toEqual(["ZEYTIN SIYAH", "PEYNIR 24O,OO"]);
    // 295.00 printed, 55.00 read: the difference is for the person to resolve.
    expect(reconcile(parsed.lines, parsed.printedTotalMinor)).toEqual({ sumMinor: 5500, differenceMinor: 24_000 });
  });

  it("reads amounts in the currency's own decimals", () => {
    expect(brief(parseReceipt(text("ラーメン 1,200\nビール 550\nTOTAL 1,750"), "JPY")).map((line) => line[3])).toEqual([1200, 550]);
    expect(parseReceipt(text("Coffee 1.250\nTOTAL 1.250"), "KWD").lines[0].lineTotalMinor).toBe(1250);
    // A whole number in a two-decimal currency is not taken for a price.
    expect(parseReceipt(text("Table 12\nCoffee 3.50"), "USD").lines.map((line) => line.label)).toEqual(["Coffee"]);
  });

  it("keeps what the recogniser said about its own confidence, and survives rubbish", () => {
    const parsed = parseReceipt(
      [{ text: "EKMEK 40,00", confidence: 41.7 }, { text: "SU 15,00" }, { text: "" }, { text: "~" }, { text: "|||| ,, .." }],
      "TRY",
    );
    expect(parsed.lines.map((line) => line.confidence)).toEqual([42, null]);
    expect(parseReceipt([], "TRY")).toEqual({ lines: [], printedTotalMinor: null, includedTaxMinor: null, unmatched: [] });
    expect(reconcile([], null)).toEqual({ sumMinor: 0, differenceMinor: null });
  });

  it("puts right the recogniser's usual slips in an amount, and only there", () => {
    const read = (row: string) => parseReceipt([{ text: row }], "RUB").lines.map((line) => [line.label, line.lineTotalMinor]);
    expect(read("Сыр российский         312 ‚50")).toEqual([["Сыр российский", 31_250]]);
    expect(read("Сыр российский 312'50")).toEqual([["Сыр российский", 31_250]]);
    expect(read("Сыр российский 312 ,50")).toEqual([["Сыр российский", 31_250]]);
    expect(read("Сыр российский 312, 50")).toEqual([["Сыр российский", 31_250]]);
    // A name with an apostrophe or a number in it is not touched.
    expect(read("Пицца д'Оро 30 см 450,00")).toEqual([["Пицца д'Оро 30 см", 45_000]]);
  });

  it("points at a row that looks read twice", () => {
    expect(
      likelyDuplicates([
        { label: "EKMEK", lineTotalMinor: 4000 },
        { label: "Ekmek", lineTotalMinor: 4000 },
        { label: "SU", lineTotalMinor: 4000 },
        { label: "SU", lineTotalMinor: 1500 },
      ]),
    ).toEqual([1]);
  });

  it("a long receipt is read whole", () => {
    const rows = Array.from({ length: 120 }, (_, index) => `URUN ${String.fromCharCode(65 + (index % 26))}${index} ${index + 1},50`);
    const parsed = parseReceipt(text([...rows, "TOPLAM 7.320,00"].join("\n")), "TRY");
    expect(parsed.lines).toHaveLength(120);
    expect(reconcile(parsed.lines, parsed.printedTotalMinor).differenceMinor).toBe(0);
  });
});

describe("the word list", () => {
  it("translates what it knows, in either direction, and keeps sizes", () => {
    expect(translateLabel("SÜT 1L", "ru")).toEqual({ text: "Молоко 1 л", source: "glossary" });
    expect(translateLabel("SUT 1 LT", "en")).toEqual({ text: "Milk 1 l", source: "glossary" });
    expect(translateLabel("TAVUK GÖĞSÜ", "ru")).toEqual({ text: "Куриное филе", source: "glossary" });
    expect(translateLabel("Tavuk gogsu 500 GR", "en")).toEqual({ text: "Chicken breast 500 g", source: "glossary" });
    expect(translateLabel("PEYNIR", "ru").text).toBe("Сыр");
    expect(translateLabel("DETERJAN", "ru").text).toBe("Средство для стирки");
    expect(translateLabel("Хлеб бородинский", "en")).toEqual({ text: "Bread", source: "glossary" });
    expect(translateLabel("Lentil soup", "ru").text).toBe("Чечевичный суп");
  });

  it("leaves what it does not know exactly as printed, and says so", () => {
    for (const unknown of ["BURN ENERJI ICECEGI", "Товар 4412", "XJ-200", "   "])
      expect(translateLabel(unknown, "ru")).toEqual({ text: unknown.trim(), source: "none" });
  });

  it("a person's own correction wins over the list, for the same printed name next time", () => {
    const mine = { ekmek: "Лаваш" };
    expect(translateLabel("EKMEK", "ru", mine)).toEqual({ text: "Лаваш", source: "user" });
    expect(translateLabel("EKMEK", "ru")).toEqual({ text: "Хлеб", source: "glossary" });
  });

  it("is an honest size: a list of everyday things, not a translator", () => {
    expect(GLOSSARY_SIZE).toBeGreaterThan(100);
    expect(GLOSSARY_SIZE).toBeLessThan(1000);
  });
});

const MEMBERS = new Set(["ann", "bob", "cy", "dee"]);
const line = (
  displayLabel: string,
  lineTotalMinor: number,
  assigned: string[] | Record<string, number>,
  extra: Partial<ReceiptLine> = {},
): ReceiptLine => ({
  kind: "item",
  originalLabel: displayLabel.toUpperCase(),
  displayLabel,
  translationSource: "none",
  quantity: "1",
  lineTotalMinor,
  confidence: 90,
  manualReviewed: false,
  assigned: Array.isArray(assigned)
    ? assigned.map((memberId) => ({ memberId, weight: 1 }))
    : Object.entries(assigned).map(([memberId, weight]) => ({ memberId, weight })),
  ...extra,
});
const receipt = (lines: ReceiptLine[], extra: Record<string, unknown> = {}) => ({
  description: "Migros",
  category: "groceries",
  date: "2026-10-12",
  currency: "TRY",
  payers: [{ memberId: "ann", paidMinor: lines.reduce((sum, item) => sum + item.lineTotalMinor, 0) }],
  receipt: { contentHash: "a".repeat(64), mimeType: "image/jpeg", lines },
  ...extra,
});
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("from an assigned receipt to an expense", () => {
  // The concept's screen 6: milk and bread for everyone, chicken and cheese for Amin, detergent for everyone.
  const concept = [
    line("Milk", 8000, ["ann", "bob", "cy", "dee"]),
    line("Chicken", 36_000, ["cy"]),
    line("Bread", 4000, ["ann", "bob", "cy", "dee"]),
    line("Cheese", 24_000, ["cy"]),
    line("Detergent", 48_000, ["ann", "bob", "cy", "dee"]),
  ];

  it("each person owes the sum of their shares of the lines, and it all adds up to the receipt", () => {
    const built = buildReceiptExpense(receipt(concept), MEMBERS);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.expense.totalMinor).toBe(120_000);
    expect(built.splits).toEqual([
      { memberId: "ann", owedMinor: 15_000 },
      { memberId: "bob", owedMinor: 15_000 },
      { memberId: "cy", owedMinor: 75_000 },
      { memberId: "dee", owedMinor: 15_000 },
    ]);
    expect(built.expense.split.mode).toBe("exact");
    for (const stored of built.lines) expect(sum(stored.allocations.map((share) => share.shareMinor))).toBe(stored.lineTotalMinor);
    expect("assigned" in built.lines[0]).toBe(false);
  });

  it("leftover units of a line go to the first people listed, the same every time", () => {
    const shares = allocateLines([line("Pizza", 1000, ["ann", "bob", "cy"]), line("Wine", 1001, { ann: 2, bob: 1 })])!;
    expect(shares[0].map((share) => share.shareMinor)).toEqual([334, 333, 333]);
    expect(shares[1].map((share) => share.shareMinor)).toEqual([667, 334]);
  });

  it("a discount, tax, service charge and tip with nobody named are spread in proportion to what each person took", () => {
    const lines = [
      line("Steak", 60_000, ["ann"]),
      line("Salad", 20_000, ["bob"]),
      line("Bread", 20_000, ["ann", "bob"]),
      line("Discount", -10_000, [], { kind: "discount" }),
      line("Service", 9000, [], { kind: "service" }),
      line("Tip", 1001, [], { kind: "tip" }),
    ];
    const built = buildReceiptExpense(receipt(lines), MEMBERS);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // Ann took 70,000 of 100,000, Bob 30,000: so 70% and 30% of each adjustment, the odd unit to Ann.
    expect(built.lines.slice(3).map((stored) => stored.allocations.map((share) => share.shareMinor))).toEqual([
      [-7000, -3000],
      [6300, 2700],
      [701, 300],
    ]);
    expect(built.splits).toEqual([
      { memberId: "ann", owedMinor: 70_001 },
      { memberId: "bob", owedMinor: 30_000 },
    ]);
    expect(built.expense.totalMinor).toBe(100_001);
  });

  it("an adjustment can be given to particular people instead", () => {
    const built = buildReceiptExpense(
      receipt([line("Dinner", 10_000, ["ann", "bob"]), line("Tip", 1000, ["bob"], { kind: "tip" })]),
      MEMBERS,
    );
    expect(built.ok && built.splits).toEqual([
      { memberId: "ann", owedMinor: 5000 },
      { memberId: "bob", owedMinor: 6000 },
    ]);
  });

  it("several payers: what they paid must be the receipt's total", () => {
    const good = buildReceiptExpense(
      receipt(concept, {
        payers: [
          { memberId: "ann", paidMinor: 100_000 },
          { memberId: "bob", paidMinor: 20_000 },
        ],
      }),
      MEMBERS,
    );
    expect(good.ok).toBe(true);
    const short = buildReceiptExpense(receipt(concept, { payers: [{ memberId: "ann", paidMinor: 100_000 }] }), MEMBERS);
    expect(short).toMatchObject({ ok: false, problems: ["payers_sum"] });
  });

  it("refuses what is not ready, and says which lines", () => {
    const problems = (lines: unknown[], extra = {}) => {
      const built = buildReceiptExpense(receipt(lines as ReceiptLine[], extra), MEMBERS);
      return built.ok ? "ok" : [built.problems.sort(), built.lines];
    };
    expect(problems([line("Milk", 8000, []), line("Bread", 4000, ["ann"])])).toEqual([["line_unassigned"], [0]]);
    expect(problems([line("Milk", 8000, ["mallory"])])).toEqual([["assignee_unknown", "line_unassigned"], [0]]);
    expect(problems([line("Milk", 0, ["ann"])])).toEqual([["line_amount"], [0]]);
    expect(problems([line("Milk", -100, ["ann"])])).toEqual([["line_amount"], [0]]);
    expect(problems([line("Milk", 100, ["ann"]), line("Discount", 50, [], { kind: "discount" })])).toEqual([["line_amount"], [1]]);
    expect(problems([line("  ", 100, ["ann"])])).toEqual([["line_label"], [0]]);
    expect(problems([line("Milk", 100, { ann: 0 })])).toEqual([["assignee_weight", "line_unassigned"], [0]]);
    expect(problems([line("Discount", -50, [], { kind: "discount" })])).toEqual([["nothing_bought"], []]);
    expect(problems([])).toEqual([["no_lines"], []]);
    expect(
      problems([line("Milk", 100, ["ann"])], {
        receipt: { contentHash: "nope", mimeType: "image/jpeg", lines: [line("Milk", 100, ["ann"])] },
      }),
    ).toEqual([["receipt_hash"], []]);
    expect(problems([line("Milk", 100, ["ann"])], { date: "yesterday" })).toEqual([["date"], []]);
    // A discount bigger than everything bought leaves nothing to pay: refused as an expense of zero or less.
    expect(problems([line("Milk", 100, ["ann"]), line("Discount", -100, [], { kind: "discount" })])).toEqual([
      ["payer_sign", "payers_sum", "total"].filter((problem) => problem !== "payer_sign"),
      [],
    ]);
  });

  it("survives anything at all being sent", () => {
    for (const hostile of [
      null,
      42,
      "receipt",
      [],
      { receipt: 7 },
      { receipt: { lines: [null, 5, "x", {}] } },
      { receipt: { lines: "many" } },
    ])
      expect(buildReceiptExpense(hostile, MEMBERS).ok).toBe(false);
  });

  it("whatever is assigned, the lines, the shares and the total cannot disagree", () => {
    // A fixed pseudo-random walk over receipts of every shape.
    let seed = 20261012;
    const next = (limit: number) => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) % limit;
    const people = [...MEMBERS];
    for (let round = 0; round < 500; round++) {
      const lines: ReceiptLine[] = Array.from({ length: 1 + next(8) }, (_, index) => {
        const among = people.filter(() => next(2) === 0);
        return line(
          `Item ${index}`,
          1 + next(99_999),
          Object.fromEntries((among.length ? among : [people[next(4)]]).map((memberId) => [memberId, 1 + next(4)])),
        );
      });
      const bought = sum(lines.map((item) => item.lineTotalMinor));
      if (next(2)) lines.push(line("Discount", -(1 + next(Math.max(1, Math.floor(bought / 2)))), [], { kind: "discount" }));
      if (next(2)) lines.push(line("Service", 1 + next(5000), [], { kind: "service" }));
      const built = buildReceiptExpense(receipt(lines), MEMBERS);
      expect(built.ok).toBe(true);
      if (!built.ok) continue;
      const total = sum(lines.map((item) => item.lineTotalMinor));
      expect(built.expense.totalMinor).toBe(total);
      expect(sum(built.splits.map((split) => split.owedMinor))).toBe(total);
      for (const stored of built.lines) expect(sum(stored.allocations.map((share) => share.shareMinor))).toBe(stored.lineTotalMinor);
      expect(totalsByMember(built.lines.map((stored) => stored.allocations))).toEqual(built.splits);
    }
  });
});

describe("the recogniser's words, put into rows", () => {
  const word = (left: number, top: number, text: string, confidence = 90, block = 1, line = 1) =>
    ["5", "1", block, "1", line, "1", left, top, text.length * 18, 30, confidence, text].join("\t");

  it("a price belongs to the name on the same row, even when the recogniser put it in another column", () => {
    const tsv = [
      "1\t1\t0\t0\t0\t0\t0\t0\t800\t600\t-1\t",
      // The names, as one "block"...
      word(40, 100, "Cola", 92, 1, 1),
      word(40, 150, "House", 91, 1, 2),
      word(150, 151, "wine", 89, 1, 2),
      word(40, 200, "TOTAL", 95, 1, 3),
      // ...and the prices, as another, read afterwards.
      word(600, 102, "12.00", 80, 2, 1),
      word(600, 149, "34.50", 60, 2, 2),
      word(600, 203, "46.50", 97, 2, 3),
    ].join("\n");
    expect(linesFromTsv(tsv)).toEqual([
      { text: "Cola 12.00", confidence: 86 },
      { text: "House wine 34.50", confidence: 80 },
      { text: "TOTAL 46.50", confidence: 96 },
    ]);
    expect(parseReceipt(linesFromTsv(tsv), "USD")).toMatchObject({
      lines: [
        { label: "Cola", lineTotalMinor: 1200 },
        { label: "House wine", lineTotalMinor: 3450 },
      ],
      printedTotalMinor: 4650,
    });
  });

  it("survives a table with nothing in it, or not a table at all", () => {
    for (const tsv of ["", "level\tpage_num", "5\t1\t1", "not\ta\ttable\nat all", "5\t1\t1\t1\t1\t1\tx\ty\t1\t1\t1\tword"])
      expect(linesFromTsv(tsv)).toEqual([]);
  });
});

describe("a real till receipt, photographed by hand", () => {
  // The rows as the recogniser gave them for a real Turkish supermarket receipt (the shop's own details left out):
  // prices marked with a star, a barcode row above every name, weighed goods on two rows, the tax class after each
  // name, stray marks at the paper's edge, two names lost to print showing through, and a tax table after the total.
  const READ = `2901268                              $
0.8660 KG — x 109,90 TL/KG             İ
UZUM SULTANI           Vis)       x94,51
RMEERET
3090021 Töğc67        isi                  39,99
ERLER m     x169,99
— PİN COOL LIME 1LT PE   X10      x64 99
8690997032959                     ği
JIMMY GÜMMY WATERMEL   X10     x29,99 Çe
2901336                                Ş
1.060 KG   x 84,90 TL/KG                 &
NEKTARİN              v5       x89,99 |
2200000071873                           b
MACRO ALİSVERİS POSE — X5        <4,00 Öl
TOPKDV                  xA2,9D6
TOPLAM               x493,46       f
TÜRK LİRASI                     x500,00
PARA ÜSTÜ      x6,54          ş
KDV           KDV TUTARI KDV'Lİ TOPLAM       kB
Bi                                x10,88                x228,49               ğe
5               x23,45        x169,99        ş
(              x8,63        x94,98        :
TEŞEKKÜR EDERİZ`;

  it("every price is found, weights go to the line they belong to, and the lines add up to the printed total", () => {
    const parsed = parseReceipt(text(READ), "TRY");
    expect(parsed.lines.map((line) => [line.label, line.quantity, line.lineTotalMinor])).toEqual([
      ["UZUM SULTANI", "0.866", 9451],
      // Two names lost to print showing through: the code and its debris go, what is left is for the person to correct.
      ["isi", "1", 3999],
      ["ERLER", "1", 16_999],
      ["PİN COOL LIME 1LT PE", "1", 6499],
      ["JIMMY GÜMMY WATERMEL", "1", 2999],
      ["NEKTARİN", "1.060", 8999],
      ["MACRO ALİSVERİS POSE", "1", 400],
    ]);
    expect(parsed.lines.every((line) => line.kind === "item")).toBe(true);
    // 493.46 printed, 493.46 read: nothing after the total (cash given, change, the tax table) was taken for a purchase.
    expect(parsed.printedTotalMinor).toBe(49_346);
    expect(reconcile(parsed.lines, parsed.printedTotalMinor)).toEqual({ sumMinor: 49_346, differenceMinor: 0 });
  });

  it("a starred price is read however the star came out, and a star is never invented where there was none", () => {
    const price = (row: string) => parseReceipt([{ text: row }], "TRY").lines.map((line) => [line.label, line.lineTotalMinor]);
    for (const mark of ["*", "x", "X", "×", "<", "«", "x "])
      expect([mark, price(`NEKTARIN %5 ${mark}89,99`)]).toEqual([mark, [["NEKTARIN", 8999]]]);
    expect(price("NEKTARIN x89 ,99 |")).toEqual([["NEKTARIN", 8999]]);
    expect(price("NEKTARIN x89 99")).toEqual([["NEKTARIN", 8999]]);
    expect(price("JIMMY GÜMMY WATERMEL X10 x29, 99.")).toEqual([["JIMMY GÜMMY WATERMEL", 2999]]);
    expect(price("TOPLAM x1.493,46 f")).toEqual([]);
    expect(parseReceipt([{ text: "TOPLAM x1.493,46 f" }], "TRY").printedTotalMinor).toBe(149_346);
    // Without a mark, two numbers side by side are not glued into a price, and a tax class is not a price.
    expect(price("COLA 89 99")).toEqual([]);
    expect(price("POSE X5 12,50")).toEqual([["POSE", 1250]]);
    expect(price("MIST 20x30 BUZDOLABI %5 *39,99")).toEqual([["MIST 20x30 BUZDOLABI", 3999]]);
  });

  it("a slanted photo: the price at the far end of a row stays with its own name", () => {
    // Three rows, 25 px apart, each falling 19 px from its left end to its right, as on the real photo.
    const word = (left: number, top: number, text: string, line: number) =>
      ["5", "1", "1", "1", line, "1", left, top, text.length * 12, 19, 90, text].join("\t");
    const row = (top: number, line: number, name: string, price: string) => [
      word(250, top, name.split(" ")[0], line),
      word(320, top - 3, name.split(" ")[1], line),
      word(545, top - 13, "%5", line),
      word(675, top - 19, price, line),
    ];
    const tsv = [
      ...row(547, 1, "UZUM SULTANI", "x94,51"),
      ...row(572, 2, "MIST BUZDOLABI", "x39,99"),
      ...row(597, 3, "BONHAIR WAX", "x169,99"),
    ].join("\n");
    expect(linesFromTsv(tsv).map((line) => line.text)).toEqual([
      "UZUM SULTANI %5 x94,51",
      "MIST BUZDOLABI %5 x39,99",
      "BONHAIR WAX %5 x169,99",
    ]);
    // The same words with the recogniser's line numbers scrambled: the rows still come out by position.
    const scrambled = tsv
      .split("\n")
      .map((line, index) => line.replace(/^5\t1\t1\t1\t\d/, `5\t1\t1\t1\t${index < 6 ? 1 : 2}`))
      .join("\n");
    expect(linesFromTsv(scrambled).map((line) => line.text)).toEqual([
      "UZUM SULTANI %5 x94,51",
      "MIST BUZDOLABI %5 x39,99",
      "BONHAIR WAX %5 x169,99",
    ]);
  });
});

describe("the till's own numbers are not what was bought", () => {
  const read = (rows: string, confidence = 90) =>
    parseReceipt(
      rows.split("\n").map((row) => ({ text: row, confidence })),
      "TRY",
    );
  const named = (rows: string) => read(rows).lines.map((line) => [line.label, line.lineTotalMinor]);

  it("a code or a barcode beside a name, or on the row above it, is left out", () => {
    expect(named("8690997032959\nJIMMY GUMMY WATERMEL %10 *29,99")).toEqual([["JIMMY GUMMY WATERMEL", 2999]]);
    expect(named("8690997032959 JIMMY GUMMY WATERMEL %10 *29,99")).toEqual([["JIMMY GUMMY WATERMEL", 2999]]);
    expect(named("JIMMY GUMMY WATERMEL 8690997032959 *29,99")).toEqual([["JIMMY GUMMY WATERMEL", 2999]]);
    expect(named("2901268\n0.860 KG x 109,90 TL/KG\nUZUM SULTANI %5 *94,51")).toEqual([["UZUM SULTANI", 9451]]);
    // A code read badly, with its debris glued on, goes whole.
    expect(named("3690021 Töğe7 MIST BUZDOLABI *39,99")).toEqual([["MIST BUZDOLABI", 3999]]);
    // A row that is nothing but a code is neither a purchase nor "text that could not be placed".
    expect(read("EKMEK 40,00\n8690997032959\n8690997032959 ği\n3690021 Töğe7\nSU 15,00")).toMatchObject({
      lines: [{ label: "EKMEK" }, { label: "SU" }],
      unmatched: [],
    });
  });

  it("scraps read from the paper's edge after a name in capitals are dropped; a name in small letters is left alone", () => {
    expect(named("MACRO ALISVERIS POSE ys *4,00")).toEqual([["MACRO ALISVERIS POSE", 400]]);
    expect(named("ERLER KS Ee *169,99")).toEqual([["ERLER KS", 16_999]]);
    expect(named("BUZDOLABI POSETI yds x39,99")).toEqual([["BUZDOLABI POSETI", 3999]]);
    expect(named("Lentil soup of the day 9,00")).toEqual([["Lentil soup of the day", 900]]);
    expect(named("Хлеб бородинский на 54,00")).toEqual([["Хлеб бородинский на", 5400]]);
    expect(named("COLA ZERO 1LT 12,50")).toEqual([["COLA ZERO 1LT", 1250]]);
  });

  it("sizes and counts that belong to a name stay in it", () => {
    for (const name of ["PIN COOL LIME 1LT PE", "MIST 20x30 BUZDOLABI", "SÜT 3,2% 1L", "YUMURTA 30'lu", "COLA 330ML 6'li", "KAĞIT A4 500"])
      expect([name, named(`${name} *12,50`)]).toEqual([name, [[name, 1250]]]);
  });

  it("a price whose name could not be read is kept without one, marked as doubtful, never given a made-up name", () => {
    const parsed = read("8690997032959 *169,99\n— | *4,00\nEKMEK 40,00");
    expect(parsed.lines.map((line) => [line.label, line.lineTotalMinor, line.confidence])).toEqual([
      ["", 16_999, 30],
      ["", 400, 30],
      ["EKMEK", 4000, 90],
    ]);
  });

  it("text the recogniser itself doubted is not paraded as something that mattered", () => {
    expect(read("EKMEK 40,00\nCRMEERET\nZEYTIN SIYAH", 20).unmatched).toEqual([]);
    expect(read("EKMEK 40,00\nZEYTIN SIYAH", 80).unmatched).toEqual(["ZEYTIN SIYAH"]);
  });
});

describe("two readings of one photo, made into one", () => {
  const rows = (lines: string) => lines.split("\n").map((row) => ({ text: row, confidence: /Töğ|ERLER|TMM|o4/.test(row) ? 25 : 85 }));
  // The real receipt as read from the photo as it is…
  const plain = parseReceipt(
    rows(`0.860 KG x 109,90 TL/KG
UZUM SULTANI           Vis)       x94,51
3690021 Töğe7        isi                  39,99
ERLER m     x169,99
— PİN COOL LIME 1LT PE   X10      x64 99
JIMMY GÜMMY WATERMEL   X10     x29, 99.
1.060 KG X 84,90 TL/KG                 &
NEKTARİN              x5       x89,99 |
MACRO ALİSVERİS POSE — X5        <4,00 Öl
TOPKDV                  x42,96
TOPLAM               «493.46 Bl`),
    "TRY",
  );
  // …and with the paper's tone evened out: one name recovered, two prices and the total lost.
  const evened = parseReceipt(
    rows(`0.860 KG — x 109,90 TL/KG
UZUM SULTANI          45       x94,51
MIST 20x30 BUZDOLABI — X5        x39,99 |
PIN COOL LİME İLT PE K10        o4 99
TMM GÜMMY WATERMEL 10       x29,99
1.060 KG x 84,90 TL./KG
NEKTARIN                           VA)              x89,99
MACRO ALISVERİS POSE    VAS)        x4,00
TOPLAM               x493,AdAb`),
    "TRY",
  );

  it("each reading alone is incomplete", () => {
    expect(plain.lines.map((line) => line.label)).toEqual([
      "UZUM SULTANI",
      "isi",
      "ERLER",
      "PİN COOL LIME 1LT PE",
      "JIMMY GÜMMY WATERMEL",
      "NEKTARİN",
      "MACRO ALİSVERİS POSE",
    ]);
    expect([evened.lines.length, evened.printedTotalMinor]).toEqual([5, null]);
  });

  it("together: every price, the better name for each row, and the total they add up to", () => {
    const merged = mergeReadings(plain, evened);
    expect(merged.lines.map((line) => [line.label, line.quantity, line.lineTotalMinor])).toEqual([
      ["UZUM SULTANI", "0.860", 9451],
      // Read as rubbish from the plain photo, properly from the evened one.
      ["MIST 20x30 BUZDOLABI", "1", 3999],
      ["ERLER", "1", 16_999],
      ["PİN COOL LIME 1LT PE", "1", 6499],
      // The other way round: the plain reading has the better name.
      ["JIMMY GÜMMY WATERMEL", "1", 2999],
      ["NEKTARİN", "1.060", 8999],
      ["MACRO ALİSVERİS POSE", "1", 400],
    ]);
    expect([merged.printedTotalMinor, merged.includedTaxMinor, merged.unmatched]).toEqual([49_346, 4296, []]);
    expect(reconcile(merged.lines, merged.printedTotalMinor).differenceMinor).toBe(0);
    // The order of the two readings does not change what is found.
    expect(mergeReadings(evened, plain).lines.map((line) => line.lineTotalMinor)).toEqual(merged.lines.map((line) => line.lineTotalMinor));
  });

  it("a row one reading invented does not spoil a reading that adds up on its own", () => {
    const good = parseReceipt(rows("EKMEK 40,00\nSU 15,00\nTOPLAM 55,00"), "TRY");
    const noisy = parseReceipt(rows("EKMEK 40,00\nSU 15,00\nGOLGE 7,00"), "TRY");
    for (const merged of [mergeReadings(good, noisy), mergeReadings(noisy, good)]) {
      expect(merged.lines.map((line) => line.label)).toEqual(["EKMEK", "SU"]);
      expect(merged.printedTotalMinor).toBe(5500);
    }
  });

  it("when nothing adds up, everything found is shown and the difference is left for the person", () => {
    const one = parseReceipt(rows("EKMEK 40,00\nTOPLAM 100,00"), "TRY");
    const other = parseReceipt(rows("SU 15,00"), "TRY");
    const merged = mergeReadings(one, other);
    expect(merged.lines.map((line) => line.label).sort()).toEqual(["EKMEK", "SU"]);
    expect(reconcile(merged.lines, merged.printedTotalMinor)).toEqual({ sumMinor: 5500, differenceMinor: 4500 });
    expect(mergeReadings(parseReceipt([], "TRY"), parseReceipt([], "TRY")).lines).toEqual([]);
  });
});

describe("evening out the paper", () => {
  it("a shadow across the page goes, and print stays darker than the paper around it everywhere", () => {
    // A page lit from the left: bright on one side, in shadow on the other, with the same grey print on both.
    const [width, height] = [200, 60];
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const paper = 230 - Math.round((x / width) * 130);
        const ink = y >= 28 && y < 32 && x % 20 < 3;
        const value = ink ? Math.round(paper * 0.45) : paper;
        pixels.set([value, value, value, 255], (y * width + x) * 4);
      }
    }
    const at = (x: number, y: number) => pixels[(y * width + x) * 4];
    // Before: the paper in the shadow is as dark as the print in the light.
    expect(at(190, 10)).toBeLessThan(at(1, 30) + 10);

    evenOut(pixels, width, height);
    const paperLight = at(10, 10);
    const paperShadow = at(190, 10);
    expect(Math.abs(paperLight - paperShadow)).toBeLessThan(12);
    expect(paperLight).toBeGreaterThan(215);
    for (const x of [1, 101, 181]) expect([x, at(x, 30) < paperShadow - 60]).toEqual([x, true]);
    // Greys, and nothing see-through.
    expect([pixels[0] === pixels[1] && pixels[1] === pixels[2], pixels[3]]).toEqual([true, 255]);
  });

  it("a small photo is enlarged for reading, a large one is not, and never more than doubled", () => {
    expect(enlargedSize(960, 1280)).toEqual({ width: 1500, height: 2000 });
    expect(enlargedSize(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(enlargedSize(300, 400)).toEqual({ width: 600, height: 800 });
  });
});
