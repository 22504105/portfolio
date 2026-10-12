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

const tidy = (label: string) =>
  label
    .replace(/^[\s*#.:\-–—]+|[\s*#.:\-–—]+$/g, "")
    .replace(/\s{2,}/g, " ")
    // A last word that is only marks and brackets (a tax class misread: "Vis)", "VAS)").
    .replace(/\s\S*[)(|\]}\[{]\S*$/, "")
    // The tax class a till prints after a name: "%08", "%1", "*5", read also as "X10" or "v5".
    .replace(/\s[%*xXvV]\s?\d{1,2}$/, "")
    .replace(/^[\s*#.:\-–—“”"'|]+|[\s*#.:\-–—“”"'|]+$/g, "")
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
      // (Not after a bare number: "3 X 4.00" is three of something at 4.00 each.)
      .replace(
        /(?<!(?:^|\s)\d{1,4}(?:[.,]\d{1,3})?\s?(?:kg|ad|adet|шт|pcs?)?\.?)(^|\s)[*x×<«»~+]{1,2} ?(\d{1,3}(?:[.,]\d{3})*) ?[.,]? ?(\d{2})(?=[.,]?\s*[^\d\s.,]{0,3}$)/iu,
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
      else if (/\p{L}{3,}/u.test(text) && lines.length > 0) unmatched.push(text);
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
    if (!/\p{L}{2,}/u.test(label)) {
      const previous = lines[lines.length - 1];
      if (counted && previous && previous.kind === "item" && previous.lineTotalMinor === amount.minor) previous.quantity = counted.quantity;
      else if (counted && unmatched.length > 0 && /\p{L}{3,}/u.test(unmatched[unmatched.length - 1])) {
        lines.push({ kind: "item", label: tidy(unmatched.pop()!), quantity: counted.quantity, lineTotalMinor: amount.minor, confidence });
      } else unmatched.push(text);
      continue;
    }
    lines.push({ kind: "item", label, quantity: counted?.quantity ?? pendingQuantity ?? "1", lineTotalMinor: amount.minor, confidence });
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
