import { images } from "./images";
import type { GalleryItem } from "./types";

export const gallerySection = {
  eyebrow: "Gallery",
  headline: "A closer look.",
  openLabel: "Open image",
  previousLabel: "Previous",
  nextLabel: "Next",
} as const;

export const gallery: GalleryItem[] = [
  { id: "exterior", caption: "Exterior", image: images.exteriorDusk },
  { id: "living-room", caption: "Living Room", image: images.oneBedroom },
  { id: "bedroom", caption: "Bedroom", image: images.bedroom },
  { id: "terrace", caption: "Terrace", image: images.terraceLounge },
  { id: "pool", caption: "Pool", image: images.pool },
  { id: "lobby", caption: "Lobby", image: images.concierge },
  { id: "terrace-dining", caption: "Terrace Dining", image: images.terraceDining },
  { id: "bathroom", caption: "Bathroom", image: images.bathroom },
];
