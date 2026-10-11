/**
 * Reads an amount typed by a person — "45", "45.5", "45,50", "$45" — as integer
 * US cents. Decimal arithmetic is done on the digits, never on floating-point
 * numbers. Returns null for anything that is not a plain non-negative amount
 * with at most two decimal places.
 */
export function parseDollarsToCents(text: string): number | null {
  const match = text.trim().replace(/^\$\s*/, "").match(/^(\d{1,7})(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Integer cents as a plain decimal for a form field: 4500 -> "45", 4550 -> "45.50". */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}
