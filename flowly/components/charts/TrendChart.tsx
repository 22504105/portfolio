"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

export type TrendPoint = {
  label: string;
  /** Net revenue in minor units. */
  current: number;
  /** The bucket in the same position of the previous period; null when that period has fewer buckets. */
  previous: number | null;
  previousLabel: string | null;
  orders: number;
};

type TrendChartProps = {
  points: TrendPoint[];
  currency: string;
  labels: { current: string; previous: string; orders: string };
  height?: number;
};

type TooltipProps = { active?: boolean; payload?: readonly { payload?: TrendPoint }[] };

/** Revenue over the period as an area, with the previous period as a dashed line behind it. */
export function TrendChart({ points, currency, labels, height = 300 }: TrendChartProps) {
  const money = (minor: number) => formatMoney(minor, currency);
  const compact = (minor: number) => formatMoney(minor, currency, { compact: true });

  const tip = ({ active, payload }: TooltipProps) => {
    const point = active ? payload?.[0]?.payload : undefined;
    if (!point) return null;
    return (
      <div className="border-line bg-surface shadow-raised rounded-[10px] border px-3 py-2.5">
        <p className="text-ink font-medium">{point.label}</p>
        <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 tabular-nums">
          <dt className="text-ink-muted">{labels.current}</dt>
          <dd className="text-ink text-right font-medium">{money(point.current)}</dd>
          {point.previous !== null && (
            <>
              <dt className="text-ink-muted">
                {labels.previous}
                {point.previousLabel && <span className="type-meta block">{point.previousLabel}</span>}
              </dt>
              <dd className="text-ink text-right">{money(point.previous)}</dd>
            </>
          )}
          <dt className="text-ink-muted">{labels.orders}</dt>
          <dd className="text-ink text-right">{point.orders}</dd>
        </dl>
      </div>
    );
  };

  return (
    // The chart is a picture of numbers that are also on the page as text and as a table.
    <div aria-hidden="true" style={{ height }} className="w-full min-w-0 text-[12px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            tick={{ fill: "var(--ink-muted)" }}
            tickMargin={10}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-muted)" }}
            tickFormatter={compact}
            tickCount={5}
            domain={[0, "auto"]}
          />
          <Tooltip content={tip} cursor={{ stroke: "var(--ink-muted)", strokeDasharray: "3 3" }} />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="var(--series-4)"
            strokeWidth={1.75}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="current"
            stroke="var(--series-1)"
            strokeWidth={2.25}
            fill="url(#trend-fill)"
            dot={points.length <= 2 ? { r: 3, fill: "var(--series-1)" } : false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
