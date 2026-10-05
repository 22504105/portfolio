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
