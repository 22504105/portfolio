import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/format";
import { bookableDates, slotsForDay } from "./slots";

// 10 July 2030 is a Wednesday (ISO weekday 3), in British Summer Time.
const DATE = "2030-07-10";
const MORNING = [{ weekday: 3, start: "10:00", end: "14:00" }];
const SPLIT = [...MORNING, { weekday: 3, start: "15:00", end: "19:00" }];
const LONG_AGO = new Date("2000-01-01T00:00:00Z");

/** London time of an instant, "HH:MM". */
const at = (time: string) => new Date(`${DATE}T${time}:00+01:00`);
const times = (slots: Date[]) => slots.map((slot) => formatDateTime(slot, "en", { hour: "2-digit", minute: "2-digit" }));

const base = { date: DATE, ranges: MORNING, intervalMinutes: 30, earliest: LONG_AGO, busy: [] };

describe("slotsForDay", () => {
  it("offers a start every half hour while the service still fits", () => {
    expect(times(slotsForDay({ ...base, durationMinutes: 45 }))).toEqual([
      "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00",
    ]);
  });

  it("fits a duration that is not a multiple of the interval", () => {
    // 65 minutes: 12:30 ends at 13:35, 13:00 would end at 14:05.
    expect(times(slotsForDay({ ...base, durationMinutes: 65 })).at(-1)).toBe("12:30");
  });

  it("lets a service end exactly at closing time", () => {
    expect(times(slotsForDay({ ...base, durationMinutes: 60 })).at(-1)).toBe("13:00");
  });

  it("never runs a service across the lunch gap", () => {
    const slots = times(slotsForDay({ ...base, ranges: SPLIT, durationMinutes: 65 }));
    expect(slots).not.toContain("13:00");
    expect(slots).not.toContain("13:30");
    expect(slots).toContain("15:00");
    expect(slots.at(-1)).toBe("17:30");
  });

  it("leaves out starts that would overlap a booking", () => {
    const busy = [{ start: at("11:00"), end: at("11:45") }];
    expect(times(slotsForDay({ ...base, durationMinutes: 45, busy }))).toEqual(["10:00", "12:00", "12:30", "13:00"]);
  });

  it("allows a start at the minute a booking ends, and an end at the minute one starts", () => {
    const busy = [{ start: at("10:45"), end: at("11:30") }];
    const slots = times(slotsForDay({ ...base, durationMinutes: 45, busy }));
    expect(slots).toContain("10:00");
    expect(slots).toContain("11:30");
    expect(slots).not.toContain("10:30");
    expect(slots).not.toContain("11:00");
  });

  it("starts no earlier than the lead time allows", () => {
    expect(times(slotsForDay({ ...base, durationMinutes: 45, earliest: at("11:10") }))[0]).toBe("11:30");
    expect(times(slotsForDay({ ...base, durationMinutes: 45, earliest: at("11:30") }))[0]).toBe("11:30");
  });

  it("keeps to the half-hour grid when working hours start off it", () => {
    const ranges = [{ weekday: 3, start: "10:15", end: "12:00" }];
    expect(times(slotsForDay({ ...base, ranges, durationMinutes: 45 }))).toEqual(["10:30", "11:00"]);
  });

  it("offers nothing on a day off", () => {
    expect(slotsForDay({ ...base, date: "2030-07-08", durationMinutes: 45 })).toEqual([]);
  });

  it("offers nothing for a service longer than the working range", () => {
    expect(slotsForDay({ ...base, durationMinutes: 300 })).toEqual([]);
  });

  it("keeps London hours on the day the clocks change", () => {
    // 31 March 2030 is a Sunday: the first day of summer time.
    const ranges = [{ weekday: 7, start: "11:00", end: "13:00" }];
    const slots = slotsForDay({ ...base, date: "2030-03-31", ranges, durationMinutes: 60 });
    expect(slots.map((slot) => slot.toISOString())).toEqual([
      "2030-03-31T10:00:00.000Z",
      "2030-03-31T10:30:00.000Z",
      "2030-03-31T11:00:00.000Z",
    ]);
  });
});

describe("bookableDates", () => {
  it("runs from today to the horizon, counted in London dates", () => {
    // 23:30 UTC on 9 July is already 10 July in London.
    const dates = bookableDates(new Date("2030-07-09T23:30:00Z"), 30);
    expect(dates[0]).toBe("2030-07-10");
    expect(dates.at(-1)).toBe("2030-08-09");
    expect(dates).toHaveLength(31);
  });
});
