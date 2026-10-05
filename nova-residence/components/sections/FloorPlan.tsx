import type { FloorPlan as FloorPlanData } from "@/data/types";
import { cn } from "@/lib/cn";

// Half a stroke of margin, so the outer walls are not cut by the viewBox.
const MARGIN = 1;

// The font size is in drawing units: keep the drawing between about 350 and
// 450 pixels wide and the labels stay between 10 and 13 pixels.
const LABEL = "fill-current stroke-none font-medium tracking-[0.06em] uppercase [font-size:14px]";

// An indicative plan drawn from data in the colour of the surrounding text:
// solid walls, a second line where a wall is glazed, dashed terrace edges.
export function FloorPlan({ plan, className }: { plan: FloorPlanData; className?: string }) {
  return (
    <svg
      role="img"
      aria-label={plan.summary}
      viewBox={`${-MARGIN} ${-MARGIN} ${plan.width + MARGIN * 2} ${plan.height + MARGIN * 2}`}
      className={cn("block h-auto w-full", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path d={plan.terraces} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={plan.glazing} vectorEffect="non-scaling-stroke" />
      <path d={plan.walls} vectorEffect="non-scaling-stroke" />
      {plan.labels.map((label) => (
        <text
          key={`${label.text}-${label.x}-${label.y}`}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className={LABEL}
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}
