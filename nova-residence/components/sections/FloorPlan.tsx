import type { FloorPlan as FloorPlanData, PlanBox, PlanDoor, PlanLine, PlanPoint } from "@/data/types";
import { cn } from "@/lib/cn";

// Every plan is drawn this many units wide, whatever its size in metres, so the
// type is the same size on all of them: at 350 pixels wide the room names are
// 11 pixels high.
const WIDTH = 440;
// Room for the heavy outer wall inside the viewBox.
const MARGIN = 4;
/** Half the depth of a glazed wall, in drawing units. */
const GLASS = 2.5;
/** Length of the scale bar, in metres. */
const SCALE_BAR = 5;

const NAME = "fill-current font-medium tracking-[0.04em] uppercase [font-size:14px]";
const FIGURE = "fill-ink-muted [font-size:13px]";

const squareMetres = (area: number) => `${area} m²`;

type FloorPlanProps = {
  plan: FloorPlanData;
  /** Names the total printed under the drawing. */
  interiorLabel: string;
  className?: string;
};

// An indicative plan drawn from data, in metres, in the colours of the
// surrounding text: heavy outer walls, thin partitions, door leaves with their
// swing, a double line where a wall is glass and the terraces as a lighter zone.
export function FloorPlan({ plan, interiorLabel, className }: FloorPlanProps) {
  const unit = WIDTH / plan.width;
  const at = (metres: number) => Number((metres * unit).toFixed(2));

  const line = ([x1, y1, x2, y2]: PlanLine) => `M${at(x1)} ${at(y1)}L${at(x2)} ${at(y2)}`;
  const outline = (points: readonly PlanPoint[]) =>
    `M${points.map(([x, y]) => `${at(x)} ${at(y)}`).join("L")}Z`;
  const box = ([x1, y1, x2, y2]: PlanBox) => `M${at(x1)} ${at(y1)}H${at(x2)}V${at(y2)}H${at(x1)}Z`;

  // A slim box around the line of the wall: the two faces of the glass.
  const glass = ([x1, y1, x2, y2]: PlanLine) =>
    x1 === x2
      ? `M${at(x1) - GLASS} ${at(y1)}h${GLASS * 2}V${at(y2)}h${-GLASS * 2}Z`
      : `M${at(x1)} ${at(y1) - GLASS}v${GLASS * 2}H${at(x2)}v${-GLASS * 2}Z`;

  // The leaf standing open, and a quarter circle from its edge to where it shuts.
  const door = ({ hinge, closed, open }: PlanDoor) => {
    const leaf = [open[0] - hinge[0], open[1] - hinge[1]];
    const shut = [closed[0] - hinge[0], closed[1] - hinge[1]];
    const radius = at(Math.hypot(leaf[0], leaf[1]));
    const clockwise = leaf[0] * shut[1] - leaf[1] * shut[0] > 0;
    return (
      `M${at(hinge[0])} ${at(hinge[1])}L${at(open[0])} ${at(open[1])}` +
      `A${radius} ${radius} 0 0 ${clockwise ? 1 : 0} ${at(closed[0])} ${at(closed[1])}`
    );
  };

  const interior = plan.rooms.reduce((total, room) => (room.outdoor ? total : total + room.area), 0);
  const foot = at(plan.depth) + 24;
  const metres = Array.from({ length: SCALE_BAR + 1 }, (_, metre) => at(metre));

  return (
    <svg
      role="img"
      aria-label={plan.summary}
      viewBox={`${-MARGIN} ${-MARGIN} ${WIDTH + MARGIN * 2} ${foot + 22 + MARGIN}`}
      className={cn("block h-auto w-full", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        d={plan.terraces.map(outline).join("")}
        className="fill-surface stroke-line-strong"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={plan.fittings.map(box).join("")}
        className="stroke-line-strong"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={plan.doors.map(door).join("")}
        className="stroke-ink-muted"
        vectorEffect="non-scaling-stroke"
      />
      <path d={plan.partitions.map(line).join("")} vectorEffect="non-scaling-stroke" />
      <path d={plan.glazing.map(glass).join("")} className="fill-bg" vectorEffect="non-scaling-stroke" />
      <path
        d={plan.walls.map(line).join("")}
        strokeWidth={3.5}
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />

      <g stroke="none" textAnchor="middle">
        {plan.rooms.map((room) => (
          <g key={`${room.name}-${room.x}-${room.y}`}>
            <text x={at(room.x)} y={at(room.y) - 3} className={NAME}>
              {room.name}
            </text>
            <text x={at(room.x)} y={at(room.y) + 14} className={FIGURE}>
              {squareMetres(room.area)}
            </text>
          </g>
        ))}
      </g>

      {/* Under the drawing: a scale bar ticked at every metre, and the interior total. */}
      <path
        d={`M0 ${foot}H${at(SCALE_BAR)}` + metres.map((x) => `M${x} ${foot - 5}V${foot}`).join("")}
        className="stroke-ink-muted"
        vectorEffect="non-scaling-stroke"
      />
      <g stroke="none" className={FIGURE}>
        <text x={0} y={foot + 17}>
          0
        </text>
        <text x={at(SCALE_BAR)} y={foot + 17} textAnchor="middle">
          {SCALE_BAR} m
        </text>
        <text x={WIDTH} y={foot + 17} textAnchor="end">
          {interiorLabel} {squareMetres(interior)}
        </text>
      </g>
    </svg>
  );
}
