import { assertMinor } from "./currency";

// Dividing an amount between people without losing or inventing a single
// minor unit.
//
// THE RULE (largest remainder, stable):
//   1. Each part first gets its exact share rounded down.
//   2. The minor units left over (always fewer than there are parts) go one
//      each to the parts whose exact share had the largest fraction cut off.
//   3. Parts with equal fractions are served in the order they were given.
//
// So the parts always add up to the total exactly, no part is more than one
// minor unit away from its exact share, and the same input gives the same
// result on every device and after every reload. A negative total (a refund)
// is divided as its positive counterpart and negated, so a refund undoes
// exactly what the purchase did.

/**
 * Splits `totalMinor` in proportion to `weights` (whole numbers, not all
 * zero, none negative). A part with weight zero gets nothing.
 */
export function allocate(totalMinor: number, weights: readonly number[]): number[] {
  assertMinor(totalMinor, "total");
  if (weights.length === 0) throw new RangeError("Nothing to split between.");
  for (const weight of weights)
    if (!Number.isSafeInteger(weight) || weight < 0) throw new RangeError(`Weights must be whole and not negative: ${weight}`);

  const sum = weights.reduce((total, weight) => total + BigInt(weight), 0n);
  if (sum === 0n) throw new RangeError("At least one weight must be more than zero.");

  const negative = totalMinor < 0;
  const total = BigInt(Math.abs(totalMinor));
  // BigInt keeps total × weight exact where a number would overflow.
  const floors = weights.map((weight) => (total * BigInt(weight)) / sum);
  const remainders = weights.map((weight) => (total * BigInt(weight)) % sum);
  let left = Number(total - floors.reduce((a, b) => a + b, 0n));

  const order = weights
    .map((_, index) => index)
    .sort((a, b) => (remainders[a] === remainders[b] ? a - b : remainders[a] > remainders[b] ? -1 : 1));
  const parts = floors.map(Number);
  for (const index of order) {
    if (left === 0) break;
    // A part with no weight never receives a leftover unit.
    if (weights[index] === 0) continue;
    parts[index] += 1;
    left -= 1;
  }
  return negative ? parts.map((part) => (part === 0 ? 0 : -part)) : parts;
}

/** The same share for everyone; leftover minor units go to the first people in the list. */
export function splitEqually(totalMinor: number, people: number): number[] {
  if (!Number.isSafeInteger(people) || people < 1) throw new RangeError("Split between at least one person.");
  return allocate(
    totalMinor,
    Array.from({ length: people }, () => 1),
  );
}

/**
 * By percentages given in hundredths of a percent (25% is 2500), which must
 * add up to exactly 100%. Percentages are typed by people; ones that do not
 * add up are an error to show, not something to normalise quietly.
 */
export function splitByPercent(totalMinor: number, basisPoints: readonly number[]): number[] {
  if (basisPoints.reduce((a, b) => a + b, 0) !== 10_000) throw new RangeError("Percentages must add up to 100.");
  return allocate(totalMinor, basisPoints);
}

/** By shares: 2 shares to one, 1 to another. */
export function splitByShares(totalMinor: number, shares: readonly number[]): number[] {
  return allocate(totalMinor, shares);
}

/** Exact amounts as typed: they are only checked. They must add up to the total, to the minor unit. */
export function checkExact(totalMinor: number, amounts: readonly number[]): { ok: true } | { ok: false; differenceMinor: number } {
  assertMinor(totalMinor, "total");
  const sum = amounts.reduce((total, amount) => total + assertMinor(amount), 0);
  return sum === totalMinor ? { ok: true } : { ok: false, differenceMinor: totalMinor - sum };
}
