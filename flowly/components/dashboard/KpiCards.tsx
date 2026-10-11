import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { fill, type Messages } from "@/lib/i18n";
import { delta, type Comparison, type Delta } from "@/lib/metrics/summary";
import { formatMoney } from "@/lib/money";
import { daysIn } from "@/lib/time";
import { cn } from "@/lib/utils";

type KpiCardsProps = {
  comparison: Comparison;
  currency: string;
  messages: Messages;
  /** Two columns at most: for narrow places such as the landing preview. */
  compact?: boolean;
};

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const whole = new Intl.NumberFormat("en-US");

function Change({ change, labels, days }: { change: Delta | null; labels: Messages["kpi"]; days: number }) {
  // No earlier value, or an earlier value of zero: there is no honest percentage to show.
  if (!change || change.ratio === null) return <p className="type-meta text-ink-muted">{labels.noComparison}</p>;

  const direction = change.absolute > 0 ? "up" : change.absolute < 0 ? "down" : "unchanged";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <p className="type-meta text-ink-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium tabular-nums",
          direction === "up" && "text-positive",
          direction === "down" && "text-negative",
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{labels[direction]} </span>
        {percent.format(change.ratio)}
      </span>
      {fill(labels.versusPrevious, { days })}
    </p>
  );
}

/** The four headline figures for a period, each with its change from the period before. */
export function KpiCards({ comparison, currency, messages, compact = false }: KpiCardsProps) {
  const { current, previous, range } = comparison;
  const labels = messages.kpi;
  const days = daysIn(range);

  const cards = [
    {
      label: labels.netRevenue,
      value: formatMoney(current.netRevenueMinor, currency),
      change: delta(current.netRevenueMinor, previous.netRevenueMinor),
    },
    {
      label: labels.completedOrders,
      value: whole.format(current.completedOrders),
      change: delta(current.completedOrders, previous.completedOrders),
    },
    {
      label: labels.averageOrder,
      value: current.averageOrderMinor === null ? labels.unavailable : formatMoney(current.averageOrderMinor, currency),
      change: delta(current.averageOrderMinor, previous.averageOrderMinor),
    },
    {
      label: labels.identifiedCustomers,
      value: whole.format(current.identifiedCustomers),
      change: delta(current.identifiedCustomers, previous.identifiedCustomers),
      note: current.anonymousOrders > 0 ? fill(labels.guestOrders, { count: whole.format(current.anonymousOrders) }) : undefined,
    },
  ];

  return (
    <dl className={cn("grid gap-5 sm:grid-cols-2", !compact && "lg:gap-6 xl:grid-cols-4")}>
      {cards.map((card) => (
        <div key={card.label} className={cn("card flex flex-col", compact ? "p-4" : "p-5 lg:p-6")}>
          <dt className="text-ink-muted font-medium">{card.label}</dt>
          <dd className="mt-2.5 flex flex-1 flex-col">
            <span className={cn("type-figure text-ink", compact && "text-[1.625rem]")}>{card.value}</span>
            <span className="mt-2.5 block">
              <Change change={card.change} labels={labels} days={days} />
            </span>
            {card.note && !compact && <span className="type-meta border-line text-ink-muted mt-3 block border-t pt-3">{card.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
