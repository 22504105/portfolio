import { Cinzel, Cormorant_Garamond, EB_Garamond, Gelasio, Inter } from "next/font/google";

// The faces the approved screens were rendered with. next/font downloads them at
// build time and serves them from the site: the client never calls Google.
// Cinzel and Gelasio have no Cyrillic: globals.css names them without next/font's fallback face,
// so their Cyrillic text falls back to the plain serif, as in the reference.

export const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const ebGaramond = EB_Garamond({
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
  display: "swap",
});

export const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

export const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-cinzel-face",
  display: "swap",
});

// Several Stitch screens fall back to ui-serif, which their screenshots show as Georgia.
// Georgia cannot be shipped and is missing on Android; Gelasio is drawn to its metrics.
export const gelasio = Gelasio({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-gelasio",
  display: "swap",
});

export const fontVariables = [inter, ebGaramond, cormorantGaramond, cinzel, gelasio].map((font) => font.variable).join(" ");
