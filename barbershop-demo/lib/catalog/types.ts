import type { Locale } from "@/i18n/routing";

/** Text kept in both languages, as the catalog tables keep it. */
export type Localized = Record<Locale, string>;

export type Service = {
  id: string;
  slug: string;
  name: Localized;
  description: Localized;
  /** Integer US cents. */
  priceCents: number;
  durationMinutes: number;
};

/** A range of working time on one day of the week, in shop local time. */
export type WorkingRange = {
  /** ISO day of week: 1 is Monday, 7 is Sunday. */
  weekday: number;
  /** "HH:MM" */
  start: string;
  end: string;
};

export type Barber = {
  id: string;
  slug: string;
  name: string;
  title: Localized;
  bio: Localized;
  /** Ids of the services this barber delivers. */
  serviceIds: string[];
  hours: WorkingRange[];
};

export type BookingPolicy = {
  holdMinutes: number;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  horizonDays: number;
  changeCutoffHours: number;
  /** The longest break a barber may take without asking. */
  maxBreakMinutes: number;
};

export type Shop = {
  name: string;
  addressLine1: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  policy: BookingPolicy;
};

/** Everything the public site and the booking flow read about the shop. */
export type Catalog = {
  shop: Shop;
  /** In display order. */
  services: Service[];
  /** In display order. */
  barbers: Barber[];
};
