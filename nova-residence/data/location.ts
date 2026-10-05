import type { TravelTime } from "./types";

export const district = {
  name: "Beşiktaş",
  lang: "tr",
  description:
    "NOVA stands on the hillside above Beşiktaş, between the waterfront and the shops and restaurants of Nişantaşı.",
} as const;

// Approximate travel times by car.
export const travelTimes: TravelTime[] = [
  { place: "Bosphorus", minutes: 5 },
  { place: "Nişantaşı", minutes: 8, lang: "tr" },
  { place: "Taksim", minutes: 10, lang: "tr" },
  { place: "Galataport", minutes: 12 },
  { place: "Istanbul Airport", minutes: 35 },
];
