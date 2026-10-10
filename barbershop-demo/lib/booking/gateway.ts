import type { Locale } from "@/i18n/routing";
import type { Contact } from "./contact";

// The contract between the booking interface and whatever answers it: server
// actions and the database when one is configured (app/actions/booking.ts),
// a mock in the browser when not (./mock-gateway.ts).

export type AvailabilityRequest = {
  serviceIds: string[];
  /** A barber's id, or null for "Any available". */
  barberId: string | null;
  /** Calendar date in the shop, "YYYY-MM-DD". */
  date: string;
};

export type Slot = {
  /** ISO instant. */
  startsAt: string;
  /** Who is free at this time, of the barbers asked about. */
  barberIds: string[];
};

export type HoldRequest = {
  serviceIds: string[];
  barberId: string | null;
  startsAt: string;
  contact: Contact;
  /** Language of the emails about this booking. */
  locale: Locale;
};

export type HoldRefusal =
  /** Someone else took the slot between looking and booking. */
  | "slot_taken"
  /** This email address already has two bookings waiting to be confirmed. */
  | "too_many_holds"
  /** The request did not pass validation on the server. */
  | "invalid"
  /** Anything else: the customer can try again. */
  | "unavailable";

export type HoldResult =
  | {
      ok: true;
      reference: string;
      /** The barber assigned — decided here when "Any available" was asked for. */
      barberId: string;
      /** ISO instant until which the slot is held, waiting for email verification. */
      expiresAt: string;
    }
  | { ok: false; code: HoldRefusal };

export type BookingGateway = {
  getAvailability(request: AvailabilityRequest): Promise<Slot[]>;
  createHold(request: HoldRequest): Promise<HoldResult>;
};
