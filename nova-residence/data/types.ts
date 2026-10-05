import type { StaticImageData } from "next/image";

export type SiteImage = {
  src: StaticImageData;
  alt: string;
  /** CSS object-position that keeps the subject in frame when cropped. */
  position?: string;
};

export type NavItem = {
  label: string;
  href: string;
};

export type Stat = {
  value: string;
  label: string;
};

export type AreaRange = {
  min: number;
  max: number;
};

export type Residence = {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  /** Interior area in square metres. */
  area: AreaRange;
  /** Starting price in US dollars. */
  priceFrom: number;
  summary: string;
  description: string;
  highlights: string[];
  image: SiteImage;
};

export type Amenity = {
  id: string;
  name: string;
  description: string;
  /** Amenities without photography are set in type only. */
  image?: SiteImage;
};

export type GalleryItem = {
  id: string;
  caption: string;
  image: SiteImage;
};

export type TravelTime = {
  id: string;
  place: string;
  minutes: number;
  /** Set for Turkish names so uppercase and screen readers treat them correctly. */
  lang?: "tr";
};
