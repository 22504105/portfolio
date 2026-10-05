import { images } from "./images";

export const architecture = {
  eyebrow: "Architecture",
  headline: "Architecture shaped by light.",
  lead: "The building steps back floor by floor, so each residence opens onto a terrace and no room is far from a window.",
  notes: [
    {
      title: "Daylight",
      text: "Glazing runs from floor to ceiling on the water side. Deep oak soffits shade it at midday and let the low evening sun reach the back of the room.",
    },
    {
      title: "Terraces",
      text: "Every terrace is planted and wide enough for a table. Sliding walls of glass open the living room onto it for most of the year.",
    },
    {
      title: "Materials",
      text: "Travertine, oak and bronze, left close to their natural finish. They take the light differently through the day, and wear in rather than out.",
    },
  ],
  primaryImage: images.terraces,
  secondaryImage: images.entrance,
} as const;
