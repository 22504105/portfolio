import type { OrderStatus } from "@/lib/domain/types";
import { toMinor } from "@/lib/money";
import type { Cell, DateOrder } from "./types";

// Reading single values out of cells. Each function answers with a value or
// with null; none of them guesses.

/** A cell as trimmed text; "" for an empty one. Numbers and dates are written out, never evaluated. */
export function cellText(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? "" : cell.toISOString();
  return String(cell).trim();
}

// ---------------------------------------------------------------- time zones

const partFormatters = new Map<string, Intl.DateTimeFormat>();

/** How far a zone is ahead of UTC at an instant, in milliseconds. */
function zoneOffset(utcMs: number, timezone: string): number {
  let formatter = partFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partFormatters.set(timezone, formatter);
  }
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(utcMs)) if (part.type !== "literal") parts[part.type] = Number(part.value);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(utcMs / 1000) * 1000;
}

/** The instant at which a wall clock in a zone shows the given date and time. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  // The offset at the first guess is right except within hours of a clock change; a second look settles that.
  const first = wall - zoneOffset(wall, timezone);
  return wall - zoneOffset(first, timezone);
}

// --------------------------------------------------------------------- dates

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const TIME = String.raw`(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*([AaPp])?\.?[Mm]?\.?)?`;
const ISO = new RegExp(String.raw`^(\d{4})-(\d{1,2})-(\d{1,2})${TIME}$`);
const ISO_ABSOLUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const NUMERIC = new RegExp(String.raw`^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})${TIME}$`);
const NAMED_DMY = new RegExp(String.raw`^(\d{1,2})[ \-]([A-Za-z]{3,9})\.?,?[ \-](\d{4})${TIME}$`);
const NAMED_MDY = new RegExp(String.raw`^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})${TIME}$`);

function clock(hour: string | undefined, minute: string | undefined, second: string | undefined, meridiem: string | undefined) {
  let h = hour === undefined ? 0 : Number(hour);
  const m = minute === undefined ? 0 : Number(minute);
  const s = second === undefined ? 0 : Number(second);
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (meridiem.toLowerCase() === "p" ? 12 : 0);
  }
  return h > 23 || m > 59 || s > 59 ? null : { h, m, s };
}

function build(
  year: number,
  month: number,
  day: number,
  time: { h: number; m: number; s: number } | null,
  timezone: string,
): number | null {
  if (!time || year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  // A date that does not exist (31 April) rolls over in JavaScript; here it is refused.
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return zonedToUtc(year, month, day, time.h, time.m, time.s, timezone);
}

/**
 * What 03/04/2026 means in a set of values: day first, month first, or it
 * cannot be told ("ambiguous"), or the values contradict each other
 * ("conflict"). "none" when no value is written that way.
 */
export function detectDateOrder(values: Iterable<string>): DateOrder | "ambiguous" | "conflict" | "none" {
  let dmy = false;
  let mdy = false;
  let any = false;
  for (const value of values) {
    const match = NUMERIC.exec(value);
    if (!match) continue;
    any = true;
    if (Number(match[1]) > 12) dmy = true;
    if (Number(match[2]) > 12) mdy = true;
  }
  if (!any) return "none";
  if (dmy && mdy) return "conflict";
  return dmy ? "dmy" : mdy ? "mdy" : "ambiguous";
}

/**
 * When an order was placed, as UTC milliseconds, or null if the cell is not a
 * date. A value with a UTC offset is an exact instant. Anything else is a
 * clock reading in the workspace time zone. 03/04/2026 needs `order`.
 */
export function parseDate(cell: Cell | undefined, timezone: string, order: DateOrder | null): number | null {
  // A spreadsheet date arrives as a Date whose UTC fields are the clock reading in the sheet.
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    // Spreadsheets keep a time as a fraction of a day, which can land a hair short of the second it means.
    const exact = new Date(Math.round(cell.getTime() / 1000) * 1000);
    return build(
      exact.getUTCFullYear(),
      exact.getUTCMonth() + 1,
      exact.getUTCDate(),
      { h: exact.getUTCHours(), m: exact.getUTCMinutes(), s: exact.getUTCSeconds() },
      timezone,
    );
  }
  // A date cell that was not formatted as one: days since the end of 1899.
  if (typeof cell === "number") {
    if (!Number.isFinite(cell) || cell < 36526 || cell > 73415) return null;
    return parseDate(new Date(Math.round((cell - 25569) * 86_400_000)), timezone, order);
  }

  const text = cellText(cell);
  if (!text) return null;

  if (ISO_ABSOLUTE.test(text)) {
    const instant = Date.parse(text);
    return Number.isNaN(instant) ? null : instant;
  }

  let match = ISO.exec(text);
  if (match) return build(Number(match[1]), Number(match[2]), Number(match[3]), clock(match[4], match[5], match[6], match[7]), timezone);

  match = NUMERIC.exec(text);
  if (match) {
    if (!order) return null;
    const [first, second] = [Number(match[1]), Number(match[2])];
    const [day, month] = order === "dmy" ? [first, second] : [second, first];
    return build(Number(match[3]), month, day, clock(match[4], match[5], match[6], match[7]), timezone);
  }

  const dayFirst = NAMED_DMY.exec(text);
  const monthFirst = dayFirst ? null : NAMED_MDY.exec(text);
  const named = dayFirst ?? monthFirst;
  if (named) {
    const month = MONTHS.indexOf((dayFirst ? named[2] : named[1]).slice(0, 3).toLowerCase()) + 1;
    const day = Number(dayFirst ? named[1] : named[2]);
    return month === 0 ? null : build(Number(named[3]), month, day, clock(named[4], named[5], named[6], named[7]), timezone);
  }
  return null;
}

// --------------------------------------------------------------------- money

/**
 * An amount in minor units, or null. Accepts "1,234.56", "1.234,56",
 * "$ 19.90", "19,9", "(12.00)" for a negative, and spreadsheet numbers.
 * Never evaluates anything: "=1+1" is not a number.
 */
export function parseAmount(cell: Cell | undefined, currency: string): number | null {
  if (typeof cell === "number") return toMinor(cell, currency);
  if (cell instanceof Date || typeof cell === "boolean") return null;

  let text = cellText(cell);
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  // Currency signs and codes around the number, and the spaces and apostrophes some locales group digits with.
  text = text.replace(/^[^\d.,\-+]+|[^\d.,]+$/g, "").replace(/[\s'  ]/g, "");
  if (text.startsWith("-") || text.startsWith("+")) {
    negative = negative !== text.startsWith("-");
    text = text.slice(1);
  }
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let decimal: "," | "." | null = null;
  if (lastComma !== -1 && lastDot !== -1) decimal = lastComma > lastDot ? "," : ".";
  else if (lastComma !== -1) decimal = /^\d{1,3}(,\d{3})+$/.test(text) ? null : ",";
  else if (lastDot !== -1) decimal = /^\d{1,3}(\.\d{3}){2,}$/.test(text) ? null : ".";

  const grouping = decimal === "," ? "." : ",";
  let normal = text.split(grouping).join("");
  if (decimal === null) normal = normal.split(".").join("");
  else if (decimal === ",") normal = normal.replace(",", ".");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(normal)) return null;

  const minor = toMinor(normal, currency);
  return minor === null ? null : negative ? -minor : minor;
}

/** A whole number of items, 1 or more; null otherwise. "2.0" is 2; "2.5" is not a quantity. */
export function parseQuantity(cell: Cell | undefined): number | null {
  const value = typeof cell === "number" ? cell : /^\d+(\.0+)?$/.test(cellText(cell)) ? Number(cellText(cell)) : Number.NaN;
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : null;
}

// -------------------------------------------------------------------- status

const STATUS_WORDS: Record<string, OrderStatus> = {
  completed: "completed",
  complete: "completed",
  paid: "completed",
  fulfilled: "completed",
  shipped: "completed",
  delivered: "completed",
  success: "completed",
  succeeded: "completed",
  closed: "completed",
  refunded: "refunded",
  refund: "refunded",
  returned: "refunded",
  cancelled: "cancelled",
  canceled: "cancelled",
  void: "cancelled",
  voided: "cancelled",
  failed: "cancelled",
  declined: "cancelled",
  pending: "pending",
  processing: "pending",
  unpaid: "pending",
  open: "pending",
  "on hold": "pending",
  "awaiting payment": "pending",
};

/** A status word from a file as one of the four Flowly knows; null for a word it does not know. */
export function parseStatus(cell: Cell | undefined): OrderStatus | null {
  return STATUS_WORDS[cellText(cell).toLowerCase().replace(/[_-]+/g, " ")] ?? null;
}

export function isEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
