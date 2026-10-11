import { compare } from "@/lib/metrics/summary";
import { DEMO_DEFAULT_RANGE, demoDataset } from "./dataset";

/** The demo workspace over the period it opens on, with the period before it. */
export function demoOverview() {
  const dataset = demoDataset();
  return {
    dataset,
    comparison: compare(dataset.orders, DEMO_DEFAULT_RANGE, dataset.workspace.timezone),
  };
}
