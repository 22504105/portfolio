import { Hanken_Grotesk, Newsreader } from "next/font/google";

// `subsets` only chooses which files are preloaded. The Latin Extended glyphs
// for Turkish names (Beşiktaş, Nişantaşı) still load on demand, below the fold.

export const displayFont = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

export const sansFont = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});
