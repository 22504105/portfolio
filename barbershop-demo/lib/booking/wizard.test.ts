import { describe, expect, it } from "vitest";
import { mockCatalog as catalog } from "@/lib/catalog/mock";
import { validateContact } from "./contact";
import { createMockGateway } from "./mock-gateway";
import { canOpen, initialState, isComplete, reduce, type WizardAction, type WizardState } from "./wizard";

const run = (state: WizardState, ...actions: WizardAction[]) =>
  actions.reduce((current, action) => reduce(current, action, catalog), state);

const CONTACT = { name: "Ada Lovelace", email: "ada@example.com", phone: "+44 20 7946 0000" };
const START = "2030-07-10T09:00:00.000Z";

/** A wizard taken as far as the review step. */
const atReview = () =>
  run(
    initialState(catalog),
    { type: "toggleService", id: "haircut" },
    { type: "next" },
    { type: "chooseBarber", barber: "marcus-hale" },
    { type: "next" },
    { type: "chooseDate", date: "2030-07-10" },
    { type: "chooseTime", startsAt: START },
    { type: "next" },
    { type: "setContact", contact: CONTACT },
    { type: "next" },
  );

describe("booking wizard", () => {
  it("starts empty on the first step", () => {
    const state = initialState(catalog);
    expect([state.step, state.serviceIds, state.barber, state.status]).toEqual(["services", [], null, "editing"]);
  });

  it("opens with the service and barber named by the link", () => {
    const state = initialState(catalog, { serviceId: "skin-fade", barberId: "theo-okafor" });
    expect([state.serviceIds, state.barber]).toEqual([["skin-fade"], "theo-okafor"]);
  });

  it("ignores a preselected barber who does not deliver the preselected service", () => {
    expect(initialState(catalog, { serviceId: "skin-fade", barberId: "marcus-hale" }).barber).toBeNull();
    expect(initialState(catalog, { serviceId: "nonsense", barberId: "nobody" }).serviceIds).toEqual([]);
  });

  it("keeps chosen services in catalog order, whatever order they were picked in", () => {
    const state = run(initialState(catalog), { type: "toggleService", id: "beard-trim" }, { type: "toggleService", id: "haircut" });
    expect(state.serviceIds).toEqual(["haircut", "beard-trim"]);
  });

  it("does not move on from a step that is not complete", () => {
    expect(run(initialState(catalog), { type: "next" }).step).toBe("services");
  });

  it("stops at services when no single barber delivers the whole selection", () => {
    // Nobody does both a skin fade and grey blending.
    const state = run(
      initialState(catalog),
      { type: "toggleService", id: "skin-fade" },
      { type: "toggleService", id: "grey-blending" },
      { type: "next" },
    );
    expect([state.step, isComplete("services", state, catalog)]).toEqual(["services", false]);
  });

  it("refuses a barber who cannot deliver the selection", () => {
    const state = run(initialState(catalog), { type: "toggleService", id: "skin-fade" }, { type: "chooseBarber", barber: "marcus-hale" });
    expect(state.barber).toBeNull();
  });

  it("drops the barber and the time when a new service rules the barber out", () => {
    const state = run(atReview(), { type: "goTo", step: "services" }, { type: "toggleService", id: "skin-fade" });
    expect([state.barber, state.startsAt]).toEqual([null, null]);
  });

  it("keeps 'any available' but drops the time when the services change", () => {
    const state = run(
      initialState(catalog),
      { type: "toggleService", id: "haircut" },
      { type: "chooseBarber", barber: "any" },
      { type: "chooseDate", date: "2030-07-10" },
      { type: "chooseTime", startsAt: START },
      { type: "toggleService", id: "beard-trim" },
    );
    expect([state.barber, state.date, state.startsAt]).toEqual(["any", "2030-07-10", null]);
  });

  it("drops the time when the barber or the date changes", () => {
    const review = atReview();
    expect(run(review, { type: "chooseBarber", barber: "leon-fischer" }).startsAt).toBeNull();
    expect(run(review, { type: "chooseDate", date: "2030-07-11" }).startsAt).toBeNull();
  });

  it("does not jump ahead of an incomplete step", () => {
    const state = run(initialState(catalog), { type: "toggleService", id: "haircut" }, { type: "goTo", step: "details" });
    expect([state.step, canOpen("details", state, catalog)]).toEqual(["services", false]);
  });

  it("goes back to any earlier step from the review", () => {
    expect(run(atReview(), { type: "goTo", step: "barber" }).step).toBe("barber");
    expect(run(atReview(), { type: "back" }).step).toBe("details");
  });

  it("does not reach the review with invalid contact details", () => {
    const state = run(atReview(), { type: "back" }, { type: "setContact", contact: { ...CONTACT, email: "ada@" } }, { type: "next" });
    expect(state.step).toBe("details");
  });

  it("ignores everything while a submission is in flight", () => {
    const state = run(atReview(), { type: "submit" }, { type: "back" }, { type: "toggleService", id: "haircut" }, { type: "submit" });
    expect([state.status, state.step, state.serviceIds]).toEqual(["submitting", "review", ["haircut"]]);
  });

  it("ends held when the slot was secured", () => {
    const result = { ok: true, reference: "CC1234", barberId: "marcus-hale", expiresAt: "2030-07-09T10:15:00.000Z" } as const;
    const state = run(atReview(), { type: "submit" }, { type: "submitted", result }, { type: "back" });
    expect([state.status, state.step, state.result]).toEqual(["held", "review", result]);
  });

  it("sends the customer back to pick another time when the slot has gone", () => {
    const state = run(atReview(), { type: "submit" }, { type: "submitted", result: { ok: false, code: "slot_taken" } });
    expect([state.status, state.step, state.startsAt, state.contact]).toEqual(["editing", "time", null, CONTACT]);
  });

  it("stays on the review, ready to retry, after any other failure", () => {
    const state = run(atReview(), { type: "submit" }, { type: "submitted", result: { ok: false, code: "unavailable" } });
    expect([state.status, state.step, state.startsAt]).toEqual(["editing", "review", START]);
  });

  it("starts over clean", () => {
    const held = run(atReview(), { type: "submit" }, {
      type: "submitted",
      result: { ok: true, reference: "CC1234", barberId: "marcus-hale", expiresAt: "2030-07-09T10:15:00.000Z" },
    });
    expect(run(held, { type: "startOver" })).toEqual(initialState(catalog));
  });
});

describe("contact validation", () => {
  it("accepts ordinary details", () => {
    expect(validateContact(CONTACT)).toEqual({});
    expect(validateContact({ name: "Иван Петров", email: "ivan@example.ru", phone: "8 (495) 123-45-67" })).toEqual({});
  });

  it("names what is missing", () => {
    expect(validateContact({ name: " ", email: "", phone: "" })).toEqual({ name: "required", email: "required", phone: "required" });
  });

  it("refuses malformed values", () => {
    expect(validateContact({ name: "A", email: "ada@example", phone: "12-34" })).toEqual({
      name: "invalid",
      email: "invalid",
      phone: "invalid",
    });
    expect(validateContact({ ...CONTACT, phone: "call me 1234567" }).phone).toBe("invalid");
    expect(validateContact({ ...CONTACT, name: "x".repeat(81) }).name).toBe("tooLong");
  });
});

describe("mock gateway", () => {
  // Tuesday 9 July 2030, 09:00 in London.
  const now = () => new Date("2030-07-09T08:00:00Z");
  const gateway = createMockGateway(catalog, now);

  it("offers only barbers who deliver every chosen service", async () => {
    const slots = await gateway.getAvailability({ serviceIds: ["haircut", "hot-towel-shave"], barberId: null, date: "2030-07-12" });
    const barbers = new Set(slots.flatMap((slot) => slot.barberIds));
    expect(slots.length).toBeGreaterThan(0);
    expect([...barbers].every((id) => ["marcus-hale", "leon-fischer"].includes(id))).toBe(true);
  });

  it("offers nothing on a Monday, when the shop is closed", async () => {
    expect(await gateway.getAvailability({ serviceIds: ["haircut"], barberId: null, date: "2030-07-15" })).toEqual([]);
  });

  it("offers nothing sooner than two hours from now", async () => {
    const slots = await gateway.getAvailability({ serviceIds: ["haircut"], barberId: null, date: "2030-07-09" });
    expect(slots.every((slot) => new Date(slot.startsAt) >= new Date("2030-07-09T10:00:00Z"))).toBe(true);
  });

  it("gives the same answer every time for the same day", async () => {
    const request = { serviceIds: ["haircut"], barberId: "marcus-hale", date: "2030-07-12" };
    expect(await gateway.getAvailability(request)).toEqual(await gateway.getAvailability(request));
  });

  it("holds an offered slot for fifteen minutes and names the barber", async () => {
    const [slot] = await gateway.getAvailability({ serviceIds: ["haircut"], barberId: null, date: "2030-07-12" });
    const result = await gateway.createHold({ serviceIds: ["haircut"], barberId: null, startsAt: slot.startsAt, contact: CONTACT, locale: "en" });
    expect(result).toMatchObject({ ok: true, barberId: slot.barberIds[0], expiresAt: "2030-07-09T08:15:00.000Z" });
  });

  it("refuses a time that was never offered", async () => {
    const result = await gateway.createHold({
      serviceIds: ["haircut"], barberId: null, startsAt: "2030-07-15T09:00:00.000Z", contact: CONTACT, locale: "en",
    });
    expect(result).toEqual({ ok: false, code: "slot_taken" });
  });
});
