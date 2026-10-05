import type { AreaRange } from "@/data/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number): string {
  return usd.format(amount);
}

export function formatArea({ min, max }: AreaRange): string {
  return `${min}–${max} m²`;
}

/** Counters and index numbers: 3 becomes "03". */
export function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
