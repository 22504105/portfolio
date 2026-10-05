import { images } from "./images";
import type { Residence } from "./types";

export const residencesSection = {
  eyebrow: "Residences",
  headline: "Three ways to live with the view.",
  intro:
    "One, two and three bedrooms, each planned around a terrace and the water beyond.",
  priceLabel: "From",
  viewLabel: "View Residence",
} as const;

export const residences: Residence[] = [
  {
    id: "one-bedroom",
    name: "1 Bedroom",
    bedrooms: 1,
    bathrooms: 1,
    area: { min: 75, max: 92 },
    priceFrom: 320_000,
    summary: "One generous room for living, open to the terrace.",
    description:
      "The plan is organised around a single living space that runs the full width of the residence. Sliding glazing opens it to a terrace deep enough to furnish, so the room extends outdoors for most of the year. The bedroom sits behind, away from the street.",
    highlights: [
      "Full-width glazing to the terrace",
      "Oak-fronted kitchen with stone worktop",
      "Bedroom with fitted wardrobes",
    ],
    image: images.oneBedroom,
  },
  {
    id: "two-bedroom",
    name: "2 Bedroom",
    bedrooms: 2,
    bathrooms: 2,
    area: { min: 110, max: 145 },
    priceFrom: 480_000,
    summary: "Kitchen, dining and living arranged along the view.",
    description:
      "Kitchen, dining and living follow one another along the window wall, each with its own outlook over the water. A travertine island anchors the room. The two bedrooms are placed at opposite ends of the plan, each with its own bathroom.",
    highlights: [
      "Travertine kitchen island",
      "Two bedrooms, each with a bathroom",
      "Terrace along the living space",
    ],
    image: images.twoBedroom,
  },
  {
    id: "three-bedroom",
    name: "3 Bedroom",
    bedrooms: 3,
    bathrooms: 3,
    area: { min: 165, max: 210 },
    priceFrom: 720_000,
    summary: "Corner residences with daylight from two sides.",
    description:
      "The three-bedroom residences occupy the corners of the building. Living and dining share a room glazed on two sides, with daylight from morning until evening, and a wraparound terrace follows it outside. The principal bedroom has a dressing room and a terrace of its own.",
    highlights: [
      "Glazing on two sides of the living room",
      "Wraparound terrace",
      "Principal bedroom with dressing room",
    ],
    image: images.threeBedroom,
  },
];
