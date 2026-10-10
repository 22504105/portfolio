import { eligibleBarbers, type Catalog } from "@/lib/catalog";
import { EMPTY_CONTACT, validateContact, type Contact } from "./contact";
import type { HoldResult } from "./gateway";

// The booking wizard as a state machine, with no React in it. Each choice
// clears whatever it makes stale: changing services can rule a barber out and
// always changes the length of the visit, so the chosen time goes.

export const STEPS = ["services", "barber", "time", "details", "review"] as const;

export type Step = (typeof STEPS)[number];

/** "any" is the customer's choice to take whoever is free. */
export type BarberChoice = string | "any";

export type WizardState = {
  step: Step;
  serviceIds: string[];
  barber: BarberChoice | null;
  /** Calendar date in the shop, "YYYY-MM-DD". */
  date: string | null;
  /** ISO instant of the chosen start. */
  startsAt: string | null;
  contact: Contact;
  /** `held` is the end of the wizard: the slot is held and an email is on its way. */
  status: "editing" | "submitting" | "held";
  /** The last answer to a submission: the hold, or why it was refused. */
  result: HoldResult | null;
};

export type WizardAction =
  | { type: "toggleService"; id: string }
  | { type: "chooseBarber"; barber: BarberChoice }
  | { type: "chooseDate"; date: string }
  | { type: "chooseTime"; startsAt: string }
  | { type: "setContact"; contact: Contact }
  | { type: "next" }
  | { type: "back" }
  | { type: "goTo"; step: Step }
  | { type: "submit" }
  | { type: "submitted"; result: HoldResult }
  | { type: "startOver" };

type Preselection = { serviceId?: string; barberId?: string };

/** A fresh wizard, optionally with a service or a barber chosen by the link that opened it. */
export function initialState(catalog: Catalog, preselection: Preselection = {}): WizardState {
  const serviceIds = catalog.services.some((service) => service.id === preselection.serviceId)
    ? [preselection.serviceId!]
    : [];
  const barber = catalog.barbers.find((candidate) => candidate.id === preselection.barberId);
  const eligible = barber && serviceIds.every((id) => barber.serviceIds.includes(id));

  return {
    step: "services",
    serviceIds,
    barber: eligible ? barber.id : null,
    date: null,
    startsAt: null,
    contact: EMPTY_CONTACT,
    status: "editing",
    result: null,
  };
}

/** Whether a step has what it needs for the customer to move past it. */
export function isComplete(step: Step, state: WizardState, catalog: Catalog): boolean {
  switch (step) {
    case "services":
      return state.serviceIds.length > 0 && eligibleBarbers(catalog.barbers, state.serviceIds).length > 0;
    case "barber":
      return state.barber !== null;
    case "time":
      return state.startsAt !== null;
    case "details":
      return Object.keys(validateContact(state.contact)).length === 0;
    case "review":
      return state.status === "held";
  }
}

/** A step can be opened once every step before it is complete. */
export function canOpen(step: Step, state: WizardState, catalog: Catalog): boolean {
  return STEPS.slice(0, STEPS.indexOf(step)).every((earlier) => isComplete(earlier, state, catalog));
}

export function reduce(state: WizardState, action: WizardAction, catalog: Catalog): WizardState {
  // Once the slot is held the wizard is over; only starting again leaves it.
  if (state.status === "held" && action.type !== "startOver") return state;
  if (state.status === "submitting" && action.type !== "submitted") return state;

  switch (action.type) {
    case "toggleService": {
      const serviceIds = state.serviceIds.includes(action.id)
        ? state.serviceIds.filter((id) => id !== action.id)
        : // Kept in catalog order, which is the order they are delivered in.
          catalog.services.map((service) => service.id).filter((id) => id === action.id || state.serviceIds.includes(id));
      const stillEligible =
        state.barber === "any" ||
        eligibleBarbers(catalog.barbers, serviceIds).some((barber) => barber.id === state.barber);
      return { ...state, serviceIds, barber: stillEligible ? state.barber : null, startsAt: null, result: null };
    }

    case "chooseBarber": {
      if (action.barber !== "any" && !eligibleBarbers(catalog.barbers, state.serviceIds).some((barber) => barber.id === action.barber)) {
        return state;
      }
      return { ...state, barber: action.barber, startsAt: null, result: null };
    }

    case "chooseDate":
      return { ...state, date: action.date, startsAt: null, result: null };

    case "chooseTime":
      return { ...state, startsAt: action.startsAt, result: null };

    case "setContact":
      return { ...state, contact: action.contact };

    case "next": {
      const next = STEPS[STEPS.indexOf(state.step) + 1];
      return next && isComplete(state.step, state, catalog) ? { ...state, step: next } : state;
    }

    case "back": {
      const previous = STEPS[STEPS.indexOf(state.step) - 1];
      return previous ? { ...state, step: previous } : state;
    }

    case "goTo":
      return canOpen(action.step, state, catalog) ? { ...state, step: action.step } : state;

    case "submit":
      return state.step === "review" && canOpen("review", state, catalog)
        ? { ...state, status: "submitting", result: null }
        : state;

    case "submitted":
      if (action.result.ok) return { ...state, status: "held", result: action.result };
      // A slot that has gone sends the customer back to choose another one.
      return {
        ...state,
        status: "editing",
        result: action.result,
        step: action.result.code === "slot_taken" ? "time" : state.step,
        startsAt: action.result.code === "slot_taken" ? null : state.startsAt,
      };

    case "startOver":
      return initialState(catalog);
  }
}
