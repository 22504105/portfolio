import { fetchAvailability, submitHold } from "@/app/actions/booking";
import type { BookingGateway } from "./gateway";

/** The booking engine: server actions in front of the database. */
export const liveGateway: BookingGateway = {
  getAvailability: fetchAvailability,
  createHold: submitHold,
};
