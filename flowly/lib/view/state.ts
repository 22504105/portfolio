import { ORDER_STATUSES, type DayRange, type OrderStatus } from "@/lib/domain/types";
import type { Dimension } from "@/lib/metrics/breakdown";
import { DIMENSIONS } from "@/lib/metrics/breakdown";
import type { Filters } from "@/lib/metrics/filters";
import { defaultGranularity, GRANULARITIES, type Granularity } from "@/lib/metrics/series";
import { addDays, isDay } from "@/lib/time";

// What a page is showing lives in its address: the period, the filters, the
// sort, the page number, the open drawer. So a view can be bookmarked or sent
// to someone, the back button undoes a filter, and the server renders exactly
// what was asked for. Everything read from an address is validated here;
// anything that is not valid is ignored, never trusted.

export type SearchParams = Record<string, string | string[] | undefined>;

export type View = {
  range: DayRange;
  filters: Filters;
  granularity: Granularity;
  dimension: Dimension;
  /** Text searched for in a table. */
  query: string;
  sort: string;
  descending: boolean;
  page: number;
  /** The order or customer whose details are open. */
  order: string | null;
  customer: string | null;
};

/** The days a workspace has data for, and the day its "last 30 days" end on. */
export type Calendar = { firstDay: string; lastDay: string };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const text = (value: string | string[] | undefined, max = 120) => (first(value) ?? "").trim().slice(0, max);

export function defaultRange(calendar: Calendar): DayRange {
  return { from: addDays(calendar.lastDay, -29), to: calendar.lastDay };
}

export function parseView(params: SearchParams, calendar: Calendar, sortable: readonly string[] = [], defaultSort = ""): View {
  const from = first(params.from);
  const to = first(params.to);
  const range = isDay(from) && isDay(to) && from <= to ? { from, to } : defaultRange(calendar);

  const statuses = text(params.status)
    .split(",")
    .filter((status): status is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(status));

  const granularity = first(params.g);
  const dimension = first(params.by);
  const sort = first(params.sort);
  const page = Number.parseInt(first(params.page) ?? "1", 10);

  return {
    range,
    filters: {
      statuses: ORDER_STATUSES.filter((status) => statuses.includes(status)),
      channel: text(params.channel) || null,
      category: text(params.category) || null,
      product: text(params.product, 300) || null,
    },
    granularity: (GRANULARITIES as readonly string[]).includes(granularity ?? "")
      ? (granularity as Granularity)
      : defaultGranularity(range),
    dimension: (DIMENSIONS as readonly string[]).includes(dimension ?? "") ? (dimension as Dimension) : "channel",
    query: text(params.q),
    sort: sort && sortable.includes(sort) ? sort : defaultSort,
    descending: first(params.dir) !== "asc",
    page: Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1,
    order: text(params.order, 200) || null,
    customer: text(params.customer, 200) || null,
  };
}

/** The parameters that carry over when moving between sections: the period and the filters. */
const SHARED = ["from", "to", "status", "channel", "category", "product"] as const;
/** Changing any of these changes what a table lists, so the page number starts over. */
const RESETS_PAGE = new Set(["from", "to", "status", "channel", "category", "product", "q", "sort", "dir"]);

type Changes = Record<string, string | number | null | undefined>;

function toQuery(entries: Iterable<[string, string]>): string {
  const query = new URLSearchParams();
  for (const [key, value] of entries) if (value !== "") query.set(key, value);
  const string = query.toString();
  return string ? `?${string}` : "";
}

/**
 * The address of the current page with some parameters changed. `null` or ""
 * removes one. Changing a filter, the search or the sort goes back to page 1;
 * drawers close unless the change opens one.
 */
export function hrefWith(pathname: string, params: SearchParams, changes: Changes): string {
  const next = new Map<string, string>();
  for (const [key, value] of Object.entries(params)) {
    const single = first(value);
    if (single) next.set(key, single);
  }
  if (Object.keys(changes).some((key) => RESETS_PAGE.has(key))) next.delete("page");
  if (!("order" in changes)) next.delete("order");
  if (!("customer" in changes)) next.delete("customer");
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return pathname + toQuery(next);
}

/** The query that keeps the period and the filters when going to another section. */
export function sharedQuery(params: SearchParams | URLSearchParams): string {
  const get = (key: string) => (params instanceof URLSearchParams ? (params.get(key) ?? "") : (first(params[key]) ?? ""));
  return toQuery(SHARED.map((key) => [key, get(key)] as [string, string]));
}

export type Preset = { key: string; range: DayRange };

/** The ready-made periods, counted back from the last day the workspace has data for. */
export function presets(calendar: Calendar): Preset[] {
  const { firstDay, lastDay } = calendar;
  const monthStart = `${lastDay.slice(0, 7)}-01`;
  const previousMonthEnd = addDays(monthStart, -1);
  return [
    { key: "last7", range: { from: addDays(lastDay, -6), to: lastDay } },
    { key: "last30", range: { from: addDays(lastDay, -29), to: lastDay } },
    { key: "last90", range: { from: addDays(lastDay, -89), to: lastDay } },
    { key: "thisMonth", range: { from: monthStart, to: lastDay } },
    { key: "lastMonth", range: { from: `${previousMonthEnd.slice(0, 7)}-01`, to: previousMonthEnd } },
    { key: "last365", range: { from: addDays(lastDay, -364), to: lastDay } },
    { key: "all", range: { from: firstDay, to: lastDay } },
  ];
}

export const sameRange = (a: DayRange, b: DayRange) => a.from === b.from && a.to === b.to;
