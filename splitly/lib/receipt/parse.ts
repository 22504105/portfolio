import { minorExponent } from "@/lib/money/currency";
import type { LineKind } from "./types";

// Reading a receipt's text: which lines are things bought, which are the
// receipt's own sums, and what the total says. This is guesswork over text
// that a camera and a recogniser have already damaged, so it is deliberately
// modest: it proposes, a person checks. It never invents a price: a line
// without a readable amount is handed back as text it could not place.

export type OcrLine = { text: string; /** 0 to 100, as the recogniser reports it. */ confidence?: number };

export type ParsedLine = {
  kind: LineKind;
  label: string;
  /** A decimal in text: "1", "2", "0.485". */
  quantity: string;
  lineTotalMinor: number;
  confidence: number | null;
};

export type ParsedReceipt = {
  lines: ParsedLine[];
  /** What the receipt itself says the total is, if a total line was found. */
  printedTotalMinor: number | null;
  /** Tax the receipt reports as already inside its prices (Turkish KDV, Russian НДС): shown for information, not added. */
  includedTaxMinor: number | null;
  /** Text that looked like it mattered but could not be placed. Never guessed at. */
  unmatched: string[];
};

// Receipts are printed in capitals and recognised imperfectly: compare without case or marks.
const fold = (text: string) =>
  text.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const WORDS = {
  total: /^(genel )?toplam\b|^(grand |net )?total\b|^amount due|^balance due|^итог|^всего(?![а-яё])|^к оплате|^tutar\b|^odenecek/,
  subtotal: /ara ?toplam|sub ?-?total|подытог|промежуточн|^toplam kdv haric/,
  tax: /\bkdv\b|topkdv|\bvat\b|\btax\b|(?<![а-яё])ндс(?![а-яё])|налог/,
  discount: /indirim|iskonto|discount|скидк|promosyon|kampanya|coupon|купон/,
  service: /servis|service|обслужив|kuver|cover charge|сервисн/,
  tip: /bahsis|\btip\b|gratuity|чаевые/,
  // How it was paid, what came back, and the till's own housekeeping: nothing that was bought.
  ignore:
    /nakit|turk lirasi|kredi kart|banka kart|para ustu|\bcash\b|\bcard\b|\bchange\b|visa|master ?card|troy|наличн|картой|сдача|безнал|\biban\b|fis no|fiş no|\bz no\b|tarih|saat|\bdate\b|\btime\b|дата|время|kasiyer|cashier|кассир|tesekkur|thank|спасибо|vergi|\bv\.?d\b|\btel\b|www\.|http|\bmersis\b|(?<![а-яё])(инн|ккт|фн|фд|фп)(?![а-яё])|чек №|receipt (no|#)|terminal|onay kodu|approval|ref(erence)? no|eku no|sicil/,
} as const;

/**
 * The amount a line ends with, and the text before it. Receipts write
 * "12,50", "1.234,50", "1,234.50", "12.5", "*12,50", "12,50 TL", "₺12,50":
 * the last group of two decimals wins; a whole number counts only when it is
 * marked as money.
 */
function trailingAmount(text: string, exponent: number): { minor: number; before: string } | null {
  const clean = text.replace(/[₺$€£₽]|\b(tl|try|usd|eur|rub|руб\.?|р\.)\s*$/giu, " ").replace(/\s+$/, "");
  const decimals = exponent === 0 ? "" : `[.,]\\s?\\d{${exponent}}`;
  const match = new RegExp(
    `(-?)\\s?[*x×]?\\s?(?<![\\p{L}\\d.,])((?:\\d{1,3}(?:[ .,]\\d{3})+|\\d+)${decimals})(?:\\s?[^\\d\\s]{1,3})?\\s?$`,
    "iu",
  ).exec(clean);
  if (!match) return null;
  const digits = match[2].replace(/\s/g, "");
  const whole = exponent === 0 ? digits.replace(/[.,]/g, "") : digits.slice(0, -(exponent + 1)).replace(/[.,]/g, "");
  const fraction = exponent === 0 ? "" : digits.slice(-exponent);
  const minor = Number(`${whole || "0"}${fraction}`);
  if (!Number.isSafeInteger(minor)) return null;
  return { minor: match[1] === "-" ? -minor : minor, before: clean.slice(0, match.index).trim() };
}

/** "2 X 15,00", "2 AD x 15.00", "0,485 kg x 89,90": how many, if the text says so. */
function quantityOf(text: string): { quantity: string; rest: string } | null {
  const match =
    /(\d{1,4}(?:[.,]\d{1,3})?)\s?(?:ad|adet|шт|pcs?|kg|кг|gr?|г|lt?|л)?\.?\s?[x×*]\s?\d+(?:[.,]\d{1,3})?\s?$/iu.exec(text) ??
    /^(\d{1,3})\s?[x×]\s+/iu.exec(text);
  if (!match) return null;
  const quantity = match[1].replace(",", ".");
  if (Number(quantity) <= 0) return null;
  return {
    quantity,
    rest: (match.index === 0 && /^\d{1,3}\s?[x×]\s+/iu.test(text) ? text.slice(match[0].length) : text.slice(0, match.index)).trim(),
  };
}

/** A size or a count that belongs in a name: "1LT", "500GR", "3,2%", "20x30", "6'li". */
const SIZE =
  /^\d{1,4}(?:[.,]\d{1,3})?(?:kg|gr?|lt?|ml|cl|cm|mm|m|шт|кг|г|л|мл|см|%|'?l[iıuü])?$|^\d{1,4}[x×*]\d{1,4}(?:[x×*]\d{1,4})?(?:cm|mm|см|мм)?$/iu;

/**
 * A name without the till's own numbers. Receipts print a product code or a
 * barcode beside or above each name ("8690997032959", "2901268"): it means
 * nothing to the people splitting the bill, and badly read it turns into
 * rubbish ("3690021 Töğe7"). A long run of digits is a code; so is whatever
 * is glued to digits right after one. Sizes ("1LT", "20x30") are kept.
 */
function withoutCodes(label: string): string {
  const kept: string[] = [];
  let afterCode = false;
  for (const token of label.split(" ")) {
    const digits = (token.match(/\d/g) ?? []).length;
    const size = SIZE.test(token);
    const code: boolean = digits >= 5 || (afterCode && digits >= 1 && !size);
    afterCode = code;
    if (!code) kept.push(token);
  }
  // A lone mark or letter left at either end is the paper's edge or a shadow, not part of a name.
  while (kept.length > 0 && /^[^\p{L}\d]+$|^\p{L}$/u.test(kept[0])) kept.shift();
  while (kept.length > 0 && /^[^\p{L}\d]+$|^\p{Ll}$/u.test(kept[kept.length - 1])) kept.pop();
  // Tills print names in capitals. In such a name, a short scrap with small letters at the end ("ys", "Ee", "yds")
  // is the recogniser reading the paper's edge or a shadow, not a word.
  const letters = kept.join("").replace(/[^\p{L}]/gu, "");
  const capitals = letters.replace(/[^\p{Lu}]/gu, "").length;
  if (letters.length >= 6 && capitals / letters.length >= 0.7) {
    while (kept.length > 1 && kept[kept.length - 1].length <= 3 && /\p{Ll}/u.test(kept[kept.length - 1])) kept.pop();
  }
  return kept.join(" ");
}

/** Whether a name has anything in it that reads as a word. */
const hasWord = (label: string) => /\p{L}{2,}/u.test(label);

const tidy = (label: string) =>
  withoutCodes(
    label
      .replace(/^[\s*#.:\-–—]+|[\s*#.:\-–—]+$/g, "")
      .replace(/\s{2,}/g, " ")
      // A last word that is only marks and brackets (a tax class misread: "Vis)", "VAS)").
      .replace(/\s\S*[)(|\]}\[{]\S*$/, "")
      // The tax class a till prints after a name: "%08", "%1", "*5", read also as "X10" or "v5".
      .replace(/\s[%*xXvV]\s?\d{1,2}$/, "")
      .replace(/^[\s*#.:\-–—“”"'|]+|[\s*#.:\-–—“”"'|]+$/g, "")
      .trim(),
  )
    .replace(/^[\s*#.:,\-–—“”"'|]+|[\s*#.:,\-–—“”"'|]+$/g, "")
    .trim();

/**
 * A row as read, with the recogniser's usual slips in amounts put right: a low quotation mark or an apostrophe where
 * the decimal comma is, and a stray space beside it ("312 ‚50" is 312,50). Only between digits; letters are left alone.
 */
function mend(text: string): string {
  return (
    text
      .replace(/\s+/g, " ")
      // Tills mark a price with a star ("*94,51"), which is read as a letter or a bracket stuck to the digits ("x94,51",
      // "<4,00", "x64 99"). At the end of a row, such a mark and what follows it is a price: the mark goes, and the
      // decimal comma is put back if it was lost.
      // (Not when the row is only a number before it: "3 X 4.00" is three of something at 4.00 each. A number after
      // a name is another matter: "UZUM 45 x94,51" is a tax class read as "45", then the price.)
      .replace(
        /(?<!^\W{0,3}\d{1,4}(?:[.,]\d{1,3})?\s?(?:kg|ad|adet|шт|pcs?)?\.?)(^|\s)[*x×<«»~+]{1,2} ?(\d{1,3}(?:[.,]\d{3})*) ?[.,]? ?(\d{2})(?=[.,]?\s*[^\d\s.,]{0,3}$)/iu,
        "$1$2,$3",
      )
      .replace(/(\d) ?[‚‘’`´'] ?(\d{2})(?!\d)/g, "$1,$2")
      .replace(/(\d) ([.,]\d{2})(?![\d.,])/g, "$1$2")
      .replace(/(\d[.,]) (\d{2})$/g, "$1$2")
      .trim()
  );
}

export function parseReceipt(ocr: readonly OcrLine[], currency: string): ParsedReceipt {
  const exponent = minorExponent(currency);
  const lines: ParsedLine[] = [];
  const unmatched: string[] = [];
  let printedTotalMinor: number | null = null;
  let includedTaxMinor: number | null = null;
  /** A quantity line that belongs to the next (or previous) priced line: "2 X 15,00" printed on its own row. */
  let pendingQuantity: string | null = null;
  let afterTotal = false;

  for (const raw of ocr) {
    const text = mend(raw.text);
    if (text.length < 2) continue;
    const folded = fold(text);
    const confidence = typeof raw.confidence === "number" ? Math.max(0, Math.min(100, Math.round(raw.confidence))) : null;
    const countOnly = /^(\d{1,4}(?:[.,]\d{1,3})?)\s?(?:ad|adet|шт|pcs?|kg|кг|gr?|г|lt?|л)?\.?\s?[x×*]\s?\d+(?:[.,]\d{1,3})?$/iu.exec(text);
    if (countOnly) {
      pendingQuantity = countOnly[1].replace(",", ".");
      continue;
    }
    // "0.860 KG x 109,90 TL/KG": what was weighed and the price per unit. The amount paid is on the row with the name.
    const weighed =
      /^\W{0,3}(\d{1,3}[.,]\d{1,4})\s?(?:kg|кг|gr?|lt?)\b.{0,8}?\d+[.,]\d{2}\s?(?:tl|try|₺|руб|р)?\.?\s?\/\s?(?:kg|кг|gr?|lt?)\b/iu.exec(
        text,
      );
    if (weighed) {
      pendingQuantity = weighed[1].replace(",", ".").replace(/(\.\d{3})\d+$/, "$1");
      continue;
    }
    const amount = trailingAmount(text, exponent);

    if (WORDS.subtotal.test(folded)) continue;
    if (WORDS.total.test(folded)) {
      // Several lines may say "total" (with and without tax, then the grand one): the last is the one to pay.
      if (amount && amount.minor > 0) {
        printedTotalMinor = amount.minor;
        afterTotal = true;
      } else unmatched.push(text);
      continue;
    }
    if (WORDS.tax.test(folded)) {
      // (Less than the total: a row of the tax table that repeats the total is not tax.)
      if (amount && amount.minor > 0 && amount.minor < (printedTotalMinor ?? Infinity))
        includedTaxMinor = (includedTaxMinor ?? 0) + amount.minor;
      continue;
    }
    // After the total come how it was paid, the change and the tax table: rows with amounts, none of them bought.
    if (afterTotal) continue;
    if (WORDS.ignore.test(folded)) continue;

    const special: LineKind | null = WORDS.discount.test(folded)
      ? "discount"
      : WORDS.service.test(folded)
        ? "service"
        : WORDS.tip.test(folded)
          ? "tip"
          : null;
    if (special) {
      if (!amount || amount.minor === 0) {
        unmatched.push(text);
        continue;
      }
      const magnitude = Math.abs(amount.minor);
      lines.push({
        kind: special,
        label: tidy(amount.before) || text,
        quantity: "1",
        lineTotalMinor: special === "discount" ? -magnitude : magnitude,
        confidence,
      });
      continue;
    }

    if (!amount) {
      // "2 X 15,00" alone on a row is the quantity of a neighbouring line; a row of letters may be a name whose price was lost.
      const alone = /^(\d{1,4}(?:[.,]\d{1,3})?)\s?(?:ad|adet|шт|pcs?|kg|кг)?\.?\s?[x×*]\s?\d/iu.exec(text);
      if (alone) pendingQuantity = alone[1].replace(",", ".");
      // Worth showing only if it reads as words: not a code row, and not something the recogniser itself doubted.
      else if (lines.length > 0 && /\p{L}{4,}/u.test(withoutCodes(text)) && (confidence === null || confidence >= 35))
        unmatched.push(withoutCodes(text));
      continue;
    }
    if (amount.minor <= 0) {
      // A negative row among the goods is money taken off: a discount on the line above.
      if (amount.minor < 0)
        lines.push({ kind: "discount", label: tidy(amount.before) || text, quantity: "1", lineTotalMinor: amount.minor, confidence });
      continue;
    }

    // A row that is only "2 X 15,00   30,00": the quantity and total of the item named on the row above.
    const counted = quantityOf(amount.before);
    const label = tidy(counted ? counted.rest : amount.before);
    if (counted && !/\p{L}{2,}/u.test(label)) {
      const previous = lines[lines.length - 1];
      if (previous && previous.kind === "item" && previous.lineTotalMinor === amount.minor) previous.quantity = counted.quantity;
      else if (unmatched.length > 0 && hasWord(unmatched[unmatched.length - 1])) {
        lines.push({ kind: "item", label: tidy(unmatched.pop()!), quantity: counted.quantity, lineTotalMinor: amount.minor, confidence });
      } else unmatched.push(text);
      continue;
    }
    // A price whose name could not be read (only a code, or nothing that is a word) is still something that was
    // bought: it is kept, without a name, for the person to name. The price is real; a made-up name would not be.
    lines.push({
      kind: "item",
      label: hasWord(label) ? label : "",
      quantity: counted?.quantity ?? pendingQuantity ?? "1",
      lineTotalMinor: amount.minor,
      confidence: hasWord(label) ? confidence : Math.min(confidence ?? 30, 30),
    });
    pendingQuantity = null;
  }

  return { lines, printedTotalMinor, includedTaxMinor, unmatched: unmatched.slice(0, 40) };
}

/** What the lines add up to, and how far that is from what the receipt says (positive: the receipt says more). */
export function reconcile(
  lines: readonly { lineTotalMinor: number }[],
  printedTotalMinor: number | null,
): { sumMinor: number; differenceMinor: number | null } {
  const sumMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  return { sumMinor, differenceMinor: printedTotalMinor === null ? null : printedTotalMinor - sumMinor };
}

/** Lines that look like the same row read twice: the same name and the same amount, one right after the other. */
export function likelyDuplicates(lines: readonly { displayLabel?: string; label?: string; lineTotalMinor: number }[]): number[] {
  const name = (line: { displayLabel?: string; label?: string }) => fold(line.displayLabel ?? line.label ?? "");
  return lines.flatMap((line, index) =>
    index > 0 && name(line) !== "" && name(line) === name(lines[index - 1]) && line.lineTotalMinor === lines[index - 1].lineTotalMinor
      ? [index]
      : [],
  );
}

/** How much of a name reads as words, weighted by how sure the recogniser was: for choosing between two readings of one row. */
function nameQuality(line: ParsedLine): number {
  const marks = line.label.replace(/\s/g, "").length;
  if (marks === 0) return 0;
  const words = (line.label.match(/\p{L}{3,}/gu) ?? []).join("").length;
  return (line.confidence ?? 50) * (words / marks);
}

/**
 * Two readings of the same receipt, made into one. The photo is read twice,
 * prepared in two ways (as it is, and with the paper's tone and shadows
 * evened out): each way loses different rows, and a price lost by one is
 * often found by the other. Rows are matched by their amounts, in order;
 * a row found by only one reading is kept; of two names for one row, the one
 * that reads more like words wins. If one reading alone adds up to the
 * printed total and the combination does not, that reading's rows are used,
 * with the better names.
 */
export function mergeReadings(first: ParsedReceipt, second: ParsedReceipt): ParsedReceipt {
  const a = first.lines;
  const b = second.lines;
  const same = (x: ParsedLine, y: ParsedLine) => x.kind === y.kind && x.lineTotalMinor === y.lineTotalMinor;

  // The longest run of rows the two readings have in common, in order.
  const common: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--)
      common[i][j] = same(a[i], b[j]) ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
  }
  const better = (x: ParsedLine, y: ParsedLine): ParsedLine => {
    const named = nameQuality(y) > nameQuality(x) ? y : x;
    return { ...named, quantity: x.quantity !== "1" ? x.quantity : y.quantity, confidence: named.confidence };
  };

  const together: ParsedLine[] = [];
  const firstNamed: ParsedLine[] = [];
  const secondNamed: ParsedLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && same(a[i], b[j])) {
      const line = better(a[i++], b[j++]);
      together.push(line);
      firstNamed.push(line);
      secondNamed.push(line);
    } else if (j >= b.length || (i < a.length && common[i + 1][j] >= common[i][j + 1])) {
      together.push(a[i]);
      firstNamed.push(a[i++]);
    } else {
      together.push(b[j]);
      secondNamed.push(b[j++]);
    }
  }

  const sum = (lines: readonly ParsedLine[]) => lines.reduce((total, line) => total + line.lineTotalMinor, 0);
  const totals = [first.printedTotalMinor, second.printedTotalMinor].filter((total): total is number => total !== null);
  // The rows and the total that agree with each other, if any do: the combination first, then either reading alone.
  const candidates: [ParsedLine[], ParsedReceipt][] = [
    [together, first],
    [firstNamed, first],
    [secondNamed, second],
  ];
  for (const [lines, source] of candidates) {
    const total = totals.find((printed) => printed === sum(lines));
    if (total !== undefined && lines.length > 0) {
      return {
        lines,
        printedTotalMinor: total,
        includedTaxMinor: first.includedTaxMinor ?? second.includedTaxMinor,
        unmatched: source === second ? second.unmatched : [],
      };
    }
  }
  // Nothing adds up: everything found is shown, and the person sees the difference.
  return {
    lines: together,
    printedTotalMinor: first.printedTotalMinor ?? second.printedTotalMinor,
    includedTaxMinor: first.includedTaxMinor ?? second.includedTaxMinor,
    unmatched: [...new Set([...first.unmatched, ...second.unmatched])].slice(0, 40),
  };
}
