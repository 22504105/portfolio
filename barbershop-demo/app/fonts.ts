import { Onest, Oswald } from "next/font/google";

// Both families carry Cyrillic: the Russian site is set in the same faces as
// the English one, not in a fallback.

export const displayFont = Oswald({
  subsets: ["latin", "cyrillic"],
  variable: "--font-oswald",
  display: "swap",
});

export const sansFont = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
});
