import { DEMO_FIRST_DAY, DEMO_LAST_DAY, demoDataset } from "@/lib/demo/dataset";
import type { Dataset, Order } from "@/lib/domain/types";
import { applyFilters, filterOptions } from "@/lib/metrics/filters";
import { compare, ordersIn, type Comparison } from "@/lib/metrics/summary";
import { sectionHref, type Section, type WorkspaceRoot } from "@/lib/routes";
import { parseView, type Calendar, type SearchParams, type View } from "@/lib/view/state";

// What a page needs to know about the workspace it is showing. The demo and a
// signed-in workspace differ only in where this comes from.

export type WorkspaceContext = {
  root: WorkspaceRoot;
  dataset: Dataset;
  calendar: Calendar;
};

export function demoWorkspace(): WorkspaceContext {
  return { root: "/demo", dataset: demoDataset(), calendar: { firstDay: DEMO_FIRST_DAY, lastDay: DEMO_LAST_DAY } };
}

export type PageData = {
  context: WorkspaceContext;
  /** The page's own address, without the query. */
  pathname: string;
  params: SearchParams;
  view: View;
  /** Every order of the workspace that passes the filters, whatever its date. */
  filtered: Order[];
  /** Those of them placed in the period. */
  inPeriod: Order[];
  comparison: Comparison;
  options: ReturnType<typeof filterOptions>;
};

/**
 * Reads the address, narrows the orders and works out the headline figures:
 * the same first steps on every page, done one way.
 */
export function loadPage(
  context: WorkspaceContext,
  section: Section,
  params: SearchParams,
  sortable: readonly string[] = [],
  defaultSort = "",
): PageData {
  const { dataset, calendar } = context;
  const view = parseView(params, calendar, sortable, defaultSort);
  const filtered = applyFilters(dataset.orders, view.filters);
  const { timezone } = dataset.workspace;
  return {
    context,
    pathname: sectionHref(context.root, section),
    params,
    view,
    filtered,
    inPeriod: ordersIn(filtered, view.range, timezone),
    comparison: compare(filtered, view.range, timezone),
    options: filterOptions(dataset.orders),
  };
}
