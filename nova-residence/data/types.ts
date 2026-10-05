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

/** A straight, axis-aligned line on a plan: x1, y1, x2, y2. */
export type PlanLine = readonly [number, number, number, number];

/** A rectangle on a plan, by two opposite corners: x1, y1, x2, y2. */
export type PlanBox = readonly [number, number, number, number];

export type PlanPoint = readonly [number, number];

/** A hinged door: the gap it closes is left open in the wall it belongs to. */
export type PlanDoor = {
  hinge: PlanPoint;
  /** Where the free edge of the leaf rests when the door is shut. */
  closed: PlanPoint;
  /** Where it is drawn, standing open. */
  open: PlanPoint;
};

export type PlanRoom = {
  name: string;
  /** Square metres, as printed under the name. */
  area: number;
  /** Centre of the label. */
  x: number;
  y: number;
  /** Terraces are not part of the interior area. */
  outdoor?: boolean;
};

/**
 * An indicative plan. Every coordinate is in metres from the top-left corner
 * of the drawing; the view is at the bottom.
 */
export type FloorPlan = {
  /** Overall size of the drawing, terraces included. */
  width: number;
  depth: number;
  /** Read out in place of the drawing. */
  summary: string;
  /** Exterior walls, drawn heavy and broken where there is a door or glazing. */
  walls: PlanLine[];
  /** Interior walls, drawn thin and broken at doors and openings. */
  partitions: PlanLine[];
  /** Windows and sliding walls of glass, drawn as a double line. */
  glazing: PlanLine[];
  doors: PlanDoor[];
  /** Outlines of the terraces, as corner points in order. */
  terraces: PlanPoint[][];
  /** Kitchen counters and islands. */
  fittings: PlanBox[];
  rooms: PlanRoom[];
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
  floorPlan: FloorPlan;
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
