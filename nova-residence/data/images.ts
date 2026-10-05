// The single registry of photography. Sections and data files take images
// from here, so replacing a file under public/images updates the whole site.
// Files are produced by `npm run images` (scripts/process-images.mjs).

import concierge from "@/public/images/amenities/concierge.jpg";
import fitness from "@/public/images/amenities/fitness.jpg";
import gardens from "@/public/images/amenities/gardens.jpg";
import lounge from "@/public/images/amenities/lounge.jpg";
import pool from "@/public/images/amenities/pool.jpg";
import entrance from "@/public/images/architecture/entrance.jpg";
import terraces from "@/public/images/architecture/terraces.jpg";
import bathroom from "@/public/images/gallery/bathroom.jpg";
import bedroom from "@/public/images/gallery/bedroom.jpg";
import exteriorDusk from "@/public/images/gallery/exterior-dusk.jpg";
import terraceDining from "@/public/images/gallery/terrace-dining.jpg";
import terraceLounge from "@/public/images/gallery/terrace-lounge.jpg";
import heroDesktop from "@/public/images/hero/hero-desktop.jpg";
import heroMobile from "@/public/images/hero/hero-mobile.jpg";
import lightStudy from "@/public/images/intro/light-study.jpg";
import bosphorus from "@/public/images/location/bosphorus.jpg";
import oneBedroom from "@/public/images/residences/one-bedroom.jpg";
import threeBedroom from "@/public/images/residences/three-bedroom.jpg";
import twoBedroom from "@/public/images/residences/two-bedroom.jpg";
import type { SiteImage } from "./types";

export const images = {
  heroDesktop: {
    src: heroDesktop,
    alt: "NOVA Residence seen from the street: terraced floors of pale travertine above olive trees, with the Bosphorus beyond.",
    position: "72% 0%",
  },
  heroMobile: {
    src: heroMobile,
    alt: "NOVA Residence rising above its garden wall, terraces planted with olive trees under a clear evening sky.",
    position: "50% 0%",
  },
  lightStudy: {
    src: lightStudy,
    alt: "Late sunlight through a linen curtain falling across a plaster wall and a travertine bench.",
    position: "100% 50%",
  },
  oneBedroom: {
    src: oneBedroom,
    alt: "Living room of a one-bedroom residence opening onto a terrace with a view over the Bosphorus.",
  },
  twoBedroom: {
    src: twoBedroom,
    alt: "Kitchen and dining area of a two-bedroom residence, with a travertine island and oak cabinetry.",
    position: "40% 50%",
  },
  threeBedroom: {
    src: threeBedroom,
    alt: "Corner living and dining space of a three-bedroom residence with glazing on two sides.",
  },
  terraces: {
    src: terraces,
    alt: "Stacked terraces seen from below: travertine edges, oak soffits and planted balconies against the sky.",
    position: "60% 50%",
  },
  entrance: {
    src: entrance,
    alt: "Street entrance framed in travertine, with a bronze screen door and climbing greenery.",
  },
  pool: {
    src: pool,
    alt: "Residents' pool on a travertine terrace, with sun loungers and the Bosphorus at dusk.",
    position: "50% 60%",
  },
  fitness: {
    src: fitness,
    alt: "Fitness room lined in oak, opening onto a planted terrace.",
    position: "40% 50%",
  },
  concierge: {
    src: concierge,
    alt: "Lobby corridor in travertine and oak with an olive tree planted in an interior garden.",
    position: "65% 50%",
  },
  lounge: {
    src: lounge,
    alt: "Residents' lounge with low seating and a lit bookshelf wall, looking onto the garden.",
  },
  gardens: {
    src: gardens,
    alt: "Terraced gardens of olive and cypress stepping down the hillside beside the building.",
    position: "60% 60%",
  },
  bosphorus: {
    src: bosphorus,
    alt: "The Bosphorus and its bridge at dusk, seen over the rooftops of the hillside below.",
    position: "50% 40%",
  },
  exteriorDusk: {
    src: exteriorDusk,
    alt: "NOVA Residence at dusk, with warm light in every residence and the city across the water.",
  },
  bedroom: {
    src: bedroom,
    alt: "Bedroom with an oak-slatted wall, linen bedding and a full-height window to the terrace.",
  },
  terraceDining: {
    src: terraceDining,
    alt: "Terrace dining table beneath an oak soffit, overlooking the Bosphorus.",
  },
  terraceLounge: {
    src: terraceLounge,
    alt: "Terrace seating beside an olive tree at sunset.",
  },
  bathroom: {
    src: bathroom,
    alt: "Bathroom finished in travertine with a walk-in shower and an oak vanity.",
  },
} satisfies Record<string, SiteImage>;
