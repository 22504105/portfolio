import type { Member } from "@/lib/domain/types";
import { parseAmount, toDecimalString } from "@/lib/money/amount";
import { correctionKey, translateLabel, type DisplayLanguage } from "@/lib/receipt/glossary";
import type { ParsedReceipt } from "@/lib/receipt/parse";
import type { LineKind, ReceiptLine, TranslationSource } from "@/lib/receipt/types";

// A receipt while a person is working on it: text in boxes and ticks, before
// it is checked and stored. Kept apart from the screens so that it can be
// tested without one.

export type DraftLine = {
  /** For the screen only: which row is which while rows are added and removed. */
  id: string;
  kind: LineKind;
  originalLabel: string;
  displayLabel: string;
  source: TranslationSource;
  quantity: string;
  /** As typed: "80,00". For a discount, typed without a minus. */
  amount: string;
  confidence: number | null;
  reviewed: boolean;
  /** Who takes it: member → weight. Empty on an adjustment means "spread over everyone". */
  assigned: Record<string, number>;
};

export type Draft = {
  lines: DraftLine[];
  /** What the receipt itself says the total is, as typed or read; empty if it says nothing. */
  printedTotal: string;
  includedTaxMinor: number | null;
  unmatched: string[];
};

let counter = 0;
export const newId = () => `line-${Date.now().toString(36)}-${++counter}`;

export const emptyLine = (kind: LineKind = "item"): DraftLine => ({
  id: newId(),
  kind,
  originalLabel: "",
  displayLabel: "",
  source: "none",
  quantity: "1",
  amount: "",
  confidence: null,
  reviewed: true,
  assigned: {},
});

/**
 * The name to show for a printed one. As printed, unless the person has
 * asked for names to be translated (then the word list is tried) or has
 * themselves renamed this very text before (their own name for it is used).
 */
function shownName(
  printed: string,
  language: DisplayLanguage,
  mine: Readonly<Record<string, string>>,
  translate: boolean,
): { text: string; source: TranslationSource } {
  const own = mine[correctionKey(printed)];
  if (own) return { text: own, source: "user" };
  return translate ? translateLabel(printed, language) : { text: printed, source: "none" };
}

/**
 * What was read from the photo, as a draft to check. Names are shown as they
 * are printed; `translate` is the person's choice to have them put into
 * their language where the word list can. A price whose name could not be
 * read gets a plain "Line 3": `unnamed` makes it.
 */
export function draftFrom(
  parsed: ParsedReceipt,
  currency: string,
  language: DisplayLanguage,
  mine: Readonly<Record<string, string>>,
  translate: boolean,
  unnamed: (position: number) => string,
): Draft {
  return {
    lines: parsed.lines.map((line, index) => {
      const shown = line.label ? shownName(line.label, language, mine, translate) : { text: unnamed(index + 1), source: "none" as const };
      return {
        id: newId(),
        kind: line.kind,
        originalLabel: line.label,
        displayLabel: shown.text,
        source: shown.source,
        quantity: line.quantity,
        amount: toDecimalString(Math.abs(line.lineTotalMinor), currency),
        confidence: line.confidence,
        reviewed: false,
        assigned: {},
      };
    }),
    printedTotal: parsed.printedTotalMinor === null ? "" : toDecimalString(parsed.printedTotalMinor, currency),
    includedTaxMinor: parsed.includedTaxMinor,
    unmatched: parsed.unmatched,
  };
}

/** The same draft with names translated or as printed. Lines the person has renamed themselves are left alone. */
export function withTranslation(
  draft: Draft,
  language: DisplayLanguage,
  mine: Readonly<Record<string, string>>,
  translate: boolean,
): Draft {
  return {
    ...draft,
    lines: draft.lines.map((line) => {
      if (line.kind !== "item" || !line.originalLabel || line.source === "user") return line;
      const shown = shownName(line.originalLabel, language, mine, translate);
      return { ...line, displayLabel: shown.text, source: shown.source };
    }),
  };
}

const TRANSLATE_KEY = "splitly-translate-v1";

/** Whether this person, on this device, wants names translated. Not unless they said so. */
export function readTranslate(): boolean {
  try {
    return window.localStorage.getItem(TRANSLATE_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberTranslate(on: boolean): void {
  try {
    window.localStorage.setItem(TRANSLATE_KEY, on ? "1" : "0");
  } catch {
    // No storage: the choice holds for this receipt.
  }
}

/** A line's amount in minor units with its sign (a discount takes off), or null if what is typed is not an amount above zero. */
export function amountOf(line: DraftLine, currency: string): number | null {
  const typed = line.amount.trim();
  const minor = parseAmount(typed.replace(/^[-−]/, ""), currency);
  if (minor === null || minor <= 0) return null;
  if (line.kind === "discount") return -minor;
  // A correction may go either way; everything else adds.
  return line.kind === "adjustment" && /^[-−]/.test(typed) ? -minor : minor;
}

/** What the lines add up to (those with a readable amount), what the receipt says, and the difference between them. */
export function totals(
  draft: Draft,
  currency: string,
): { sumMinor: number; printedMinor: number | null; differenceMinor: number | null; unreadable: number } {
  let sumMinor = 0;
  let unreadable = 0;
  for (const line of draft.lines) {
    const amount = amountOf(line, currency);
    if (amount === null) unreadable++;
    else sumMinor += amount;
  }
  const printedMinor = draft.printedTotal.trim() === "" ? null : parseAmount(draft.printedTotal, currency);
  return { sumMinor, printedMinor, differenceMinor: printedMinor === null ? null : printedMinor - sumMinor, unreadable };
}

/** Lines that need a look: read with little confidence and not yet touched by a person. */
export const LOW_CONFIDENCE = 70;
export const needsLook = (line: DraftLine) => !line.reviewed && line.confidence !== null && line.confidence < LOW_CONFIDENCE;

/** The draft in the shape that is checked and stored. Text that is not a number becomes NaN, which the check refuses. */
export function toReceiptLines(draft: Draft, currency: string, members: readonly Member[]): ReceiptLine[] {
  const current = members.filter((member) => !member.removedAt).map((member) => member.id);
  return draft.lines.map((line) => ({
    kind: line.kind,
    originalLabel: line.originalLabel.trim() || line.displayLabel.trim(),
    displayLabel: line.displayLabel.trim(),
    translationSource: line.source,
    quantity: /^\d{1,6}(\.\d{1,3})?$/.test(line.quantity) ? line.quantity : "1",
    lineTotalMinor: amountOf(line, currency) ?? NaN,
    confidence: line.confidence,
    manualReviewed: line.reviewed,
    // In the group's own order, so that leftover units always go to the same people.
    assigned: current
      .filter((memberId) => (line.assigned[memberId] ?? 0) > 0)
      .map((memberId) => ({ memberId, weight: line.assigned[memberId] })),
  }));
}

const CORRECTIONS_KEY = "splitly-glossary-v1";

/** The names this person has given to printed text before, on this device. */
export function readCorrections(): Record<string, string> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CORRECTIONS_KEY) ?? "{}") as unknown;
    return stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Remembers, on this device only, what the person called each printed name they renamed. */
export function rememberCorrections(lines: readonly DraftLine[]): void {
  const renamed = lines.filter(
    (line) => line.source === "user" && line.kind === "item" && line.originalLabel.trim() && line.displayLabel.trim(),
  );
  if (renamed.length === 0) return;
  try {
    const all = readCorrections();
    for (const line of renamed) all[correctionKey(line.originalLabel)] = line.displayLabel.trim().slice(0, 200);
    // The most recent few hundred: enough for a household, small enough to keep.
    window.localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(Object.fromEntries(Object.entries(all).slice(-400))));
  } catch {
    // No storage: the correction holds for this receipt only.
  }
}
