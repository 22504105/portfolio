import type { TravelTime } from "./types";

export const district = {
  name: "Beşiktaş",
  lang: "tr",
  description:
    "NOVA stands on the hillside above Beşiktaş, between the waterfront and the shops and restaurants of Nişantaşı.",
} as const;

export const locationSection = {
  eyebrow: "Location",
  headline: "Istanbul at your doorstep.",
  travelNote: "Approximate travel times by car.",
  minutesUnit: "min",
} as const;

export const travelTimes: TravelTime[] = [
  { id: "bosphorus", place: "Bosphorus", minutes: 5 },
  { id: "nisantasi", place: "Nişantaşı", minutes: 8, lang: "tr" },
  { id: "taksim", place: "Taksim", minutes: 10 },
  { id: "galataport", place: "Galataport", minutes: 12 },
  { id: "airport", place: "Istanbul Airport", minutes: 35 },
];
