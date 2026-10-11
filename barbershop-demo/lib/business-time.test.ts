import { describe, expect, it } from "vitest";
import { addDays, businessDate, isoWeekday, zonedInstant } from "./business-time";

const iso = (date: Date) => date.toISOString();

describe("zonedInstant", () => {
  it("reads a summer time as British Summer Time", () => {
    expect(iso(zonedInstant("2030-07-10", "10:00"))).toBe("2030-07-10T09:00:00.000Z");
  });

  it("reads a winter time as Greenwich Mean Time", () => {
    expect(iso(zonedInstant("2030-01-10", "10:00"))).toBe("2030-01-10T10:00:00.000Z");
  });

  it("changes with the clocks in spring", () => {
    expect(iso(zonedInstant("2030-03-30", "10:00"))).toBe("2030-03-30T10:00:00.000Z");
    expect(iso(zonedInstant("2030-03-31", "10:00"))).toBe("2030-03-31T09:00:00.000Z");
  });

  it("changes with the clocks in autumn", () => {
    expect(iso(zonedInstant("2030-10-26", "10:00"))).toBe("2030-10-26T09:00:00.000Z");
    expect(iso(zonedInstant("2030-10-27", "10:00"))).toBe("2030-10-27T10:00:00.000Z");
  });

  it("handles a time just after midnight", () => {
    expect(iso(zonedInstant("2030-07-10", "00:30"))).toBe("2030-07-09T23:30:00.000Z");
  });
});

describe("businessDate", () => {
  it("is the date in London, not in UTC", () => {
    expect(businessDate(new Date("2030-07-09T23:30:00Z"))).toBe("2030-07-10");
    expect(businessDate(new Date("2030-01-09T23:30:00Z"))).toBe("2030-01-09");
  });
});

describe("calendar helpers", () => {
  it("adds days across months and years", () => {
    expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(addDays("2030-12-31", 1)).toBe("2031-01-01");
    expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
  });

  it("is not thrown by the clock change", () => {
    expect(addDays("2030-03-30", 1)).toBe("2030-03-31");
    expect(addDays("2030-03-31", 1)).toBe("2030-04-01");
  });

  it("gives ISO weekdays, Monday first", () => {
    expect(isoWeekday("2030-07-08")).toBe(1);
    expect(isoWeekday("2030-07-10")).toBe(3);
    expect(isoWeekday("2030-07-14")).toBe(7);
  });
});
