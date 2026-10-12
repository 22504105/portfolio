import type { Category } from "@/lib/domain/types";

// A receipt, from the paper to the expense. Amounts are whole minor units of
// the expense's currency. A line is something bought, or one of the receipt's
// own adjustments; a discount is a negative line.

export const LINE_KINDS = ["item", "discount", "tax", "tip", "service", "adjustment"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

/** Where a line's shown name came from: the word list, the person, or nowhere (shown as printed). */
export type TranslationSource = "none" | "glossary" | "user";

export type ReceiptLine = {
  kind: LineKind;
  /** The text as printed. Always kept. */
  originalLabel: string;
  /** The text as shown. */
  displayLabel: string;
  translationSource: TranslationSource;
  /** "1", "2", "0.485": as printed, a decimal in text. */
  quantity: string;
  lineTotalMinor: number;
  /** How sure the reading was, 0 to 100; null for a line typed by hand. */
  confidence: number | null;
  /** A person looked at this line and changed or confirmed it. */
  manualReviewed: boolean;
  /**
   * Who takes this line, and in what proportion (1 each for "equally").
   * Empty on an adjustment means: spread it over everyone in proportion to
   * what they took.
   */
  assigned: { memberId: string; weight: number }[];
};

/** What a person submits to turn a receipt into an expense. Every share is worked out from it, never taken on trust. */
export type ReceiptExpenseInput = {
  description: string;
  category: Category | null;
  date: string;
  currency: string;
  payers: { memberId: string; paidMinor: number }[];
  receipt: {
    /** SHA-256 of the photo, in hex: how the same receipt is recognised if it is scanned twice. The photo itself is never sent. */
    contentHash: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    lines: ReceiptLine[];
  };
  /** The person was told this receipt is already in the group and chose to add it again. */
  allowDuplicate?: boolean;
};

/** A stored line, with what each person took of it. */
export type StoredReceiptLine = Omit<ReceiptLine, "assigned"> & {
  allocations: { memberId: string; shareMinor: number }[];
  /** How the line was divided: the same for everyone it went to, or by weights (which is also how a spread adjustment is recorded). */
  method: "equal" | "shares";
};

export const RECEIPT_LIMITS = { lines: 200, labelLength: 200 } as const;
