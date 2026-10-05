import { images } from "./images";
import type { Amenity } from "./types";

export const amenitiesSection = {
  eyebrow: "Amenities",
  headline: "Rooms beyond your own.",
  intro:
    "The shared spaces are planned as extensions of the residences: the same materials, the same light, a few steps from the door.",
} as const;

export const amenities: Amenity[] = [
  {
    id: "pool",
    name: "Private Pool",
    description:
      "An outdoor pool on the garden terrace, heated through the cooler months and open to the view.",
    image: images.pool,
  },
  {
    id: "fitness",
    name: "Fitness & Wellness",
    description:
      "A training room that opens onto its own terrace, with a sauna and treatment room alongside.",
    image: images.fitness,
  },
  {
    id: "concierge",
    name: "24/7 Concierge",
    description:
      "Someone at the door at every hour, for deliveries, guests and the small arrangements of a day.",
    image: images.concierge,
  },
  {
    id: "lounge",
    name: "Residents Lounge",
    description:
      "A shared living room on the garden level, for reading, working or receiving guests.",
    image: images.lounge,
  },
  {
    id: "gardens",
    name: "Landscaped Gardens",
    description:
      "Terraces of olive, cypress and lavender that step down the hillside around the building.",
    image: images.gardens,
  },
  {
    id: "parking",
    name: "Private Parking",
    description:
      "Two levels below ground with a space for every residence, charging points and direct lift access.",
  },
];
