import type { Locale } from "@/i18n/routing";
import type { Barber, Localized, Service, Shop } from "@/lib/catalog";

// What the admin pages show, and where it comes from. Two sources implement
// the same interface: the database (./live.ts) for the real admin, and
// invented data (./demo.ts) for the public demo, which never touches the
// database at all.

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";

export type AdminBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  barberId: string;
  barberName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  locale: Locale;
  source: "web" | "admin";
  /** The snapshot taken when the booking was made. */
  services: { name: Localized; priceCents: number }[];
  totalPriceCents: number;
  totalDurationMinutes: number;
  /** Money recorded at the counter, if any. Independent of the status. */
  paidCents: number | null;
  paidMethod: "cash" | "card_terminal" | null;
};

export type BookingEvent = {
  at: Date;
  type: string;
  actor: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus | null;
};

export type AdminService = Service & { isActive: boolean };
export type AdminBarber = Barber & { isActive: boolean; hasAccount: boolean };

export type AdminTimeOff = {
  id: string;
  /** Null for a closure of the whole shop. */
  barberId: string | null;
  barberName: string | null;
  kind: "break" | "time_off" | "holiday";
  status: "requested" | "approved" | "rejected";
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
};

export type AdminClient = {
  email: string;
  name: string;
  phone: string;
  hasAccount: boolean;
  visits: number;
  noShows: number;
  lastVisit: Date | null;
  nextVisit: Date | null;
};

export type Analytics = {
  from: string;
  to: string;
  bookings: number;
  byStatus: Partial<Record<BookingStatus, number>>;
  paidCents: number;
  payments: number;
  topServices: { name: Localized; visits: number; listedCents: number }[];
  barbers: {
    id: string;
    name: string;
    completed: number;
    noShows: number;
    cancelled: number;
    bookedMinutes: number;
    availableMinutes: number;
    paidCents: number;
  }[];
};

export type BookingFilter = {
  status?: BookingStatus;
  /** Matches the reference, the name, the phone or the email. */
  search?: string;
};

export type AdminSource = {
  /** True for the public demo: the pages then show no forms and no buttons that change anything. */
  readOnly: boolean;
  shop(): Promise<Shop>;
  /** Every service and barber, retired ones included. */
  services(): Promise<AdminService[]>;
  barbers(): Promise<AdminBarber[]>;
  /** Bookings that overlap a range of time, earliest first; holds and expired ones left out. */
  bookingsBetween(from: Date, to: Date): Promise<AdminBooking[]>;
  /** The most recent bookings matching a filter, newest first. */
  findBookings(filter: BookingFilter): Promise<AdminBooking[]>;
  booking(id: string): Promise<{ booking: AdminBooking; events: BookingEvent[] } | null>;
  /** Confirmed appointments that are over and have no outcome yet. */
  awaitingOutcome(): Promise<AdminBooking[]>;
  /** Requests waiting for a decision, and approved time off that has not ended. */
  timeOff(): Promise<AdminTimeOff[]>;
  clients(): Promise<AdminClient[]>;
  /** Figures for a range of shop-local dates, both ends included. */
  analytics(from: string, to: string): Promise<Analytics>;
};
