import { district, travelTimes } from "@/data/location";
import { site } from "@/data/site";
import type { TravelTime } from "@/data/types";
import { cn } from "@/lib/cn";

// A drawn abstraction of the European shore, not a survey: north is up, the
// Bosphorus runs down the right and the Golden Horn cuts in at the lower left.
// Below `sm` the frame is taller than the drawing, so only the middle band
// (x 160–640) shows; everything that must be read sits inside it.
const WIDTH = 800;
const HEIGHT = 600;
const NOVA = { x: 470, y: 215 };

/** Drawing units per minute of travel: the rings and the places share it. */
const MINUTE = 22;

/** Compass bearing from NOVA, in degrees, for each place marked with a point (by travel-time id). */
const BEARING: Record<string, number> = {
  nisantasi: 300,
  taksim: 235,
  galataport: 202,
};

const WATER_ID = "bosphorus";
const OFF_MAP_ID = "airport";

const EUROPE_SHORE =
  "C580 80 562 150 545 215 C524 296 452 372 404 424 C384 446 366 462 352 492 " +
  "C342 514 300 520 250 508 C170 488 90 446 0 436";
const OLD_CITY_SHORE = "C90 480 170 526 250 548 C310 564 356 566 392 600";
const ASIA_SHORE = "C760 506 708 424 700 320 C692 206 730 120 742 0";

const WATER = `M590 0 ${EUROPE_SHORE} L0 472 ${OLD_CITY_SHORE} L800 600 L800 548 ${ASIA_SHORE} Z`;
const SHORES = `M590 0 ${EUROPE_SHORE} M0 472 ${OLD_CITY_SHORE} M800 548 ${ASIA_SHORE}`;

const CONTOURS =
  "M548 0 C540 84 520 150 502 214 C480 292 414 356 372 396 C330 436 280 440 230 428 C150 408 80 392 0 388 " +
  "M486 0 C480 70 456 140 436 200 C410 280 350 330 300 368 C250 404 190 394 130 370 C80 350 40 342 0 340 " +
  "M0 528 C80 538 150 574 196 600";

// Font sizes are in drawing units and step with the breakpoints so labels stay
// close to 12px on screen while the drawing scales with its column.
const LABEL =
  "fill-current font-medium tracking-[0.14em] uppercase " +
  "[font-size:17px] sm:[font-size:16px] md:[font-size:13px] lg:[font-size:15px] xl:[font-size:12px]";

// Labels knock out the hairlines they cross.
const HALO = { stroke: "var(--color-bg)", strokeWidth: 6, paintOrder: "stroke" } as const;

function position({ id, minutes }: TravelTime) {
  const radians = (BEARING[id] * Math.PI) / 180;
  const distance = minutes * MINUTE;
  return {
    x: Math.round(NOVA.x + distance * Math.sin(radians)),
    y: Math.round(NOVA.y - distance * Math.cos(radians)),
  };
}

export function LocationMap({ className }: { className?: string }) {
  const points = travelTimes.filter((item) => item.id in BEARING);
  const rings = travelTimes.filter((item) => item.id !== OFF_MAP_ID);
  const water = travelTimes.find((item) => item.id === WATER_ID);
  const offMap = travelTimes.find((item) => item.id === OFF_MAP_ID);
  const names = travelTimes.map((item) => item.place).join(", ");

  return (
    <div data-tone="base" className={cn("bg-bg text-ink", className)}>
      <svg
        role="img"
        aria-label={`Stylised map of ${district.name} on the European shore of the Bosphorus, showing ${site.shortName} in relation to: ${names}.`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className="block size-full"
      >
        <path d={WATER} fill="var(--color-line)" />

        <g fill="none" strokeWidth={1}>
          <path d={CONTOURS} stroke="var(--color-line)" vectorEffect="non-scaling-stroke" />
          <path d={SHORES} stroke="var(--color-line-strong)" vectorEffect="non-scaling-stroke" />
          {rings.map((item) => (
            <circle
              key={item.id}
              cx={NOVA.x}
              cy={NOVA.y}
              r={item.minutes * MINUTE}
              stroke="var(--color-line-strong)"
              strokeDasharray="1 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {offMap && (
          <g>
            <path
              d="M214 38 L188 0"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={222} y={48} lang={offMap.lang} dominantBaseline="middle" className={LABEL} {...HALO}>
              {offMap.place}
            </text>
          </g>
        )}

        {water && (
          <text
            x={582}
            y={322}
            lang={water.lang}
            textAnchor="middle"
            dominantBaseline="middle"
            transform="rotate(-64 582 322)"
            className={cn(LABEL, "text-ink-muted")}
            style={{ letterSpacing: "0.26em" }}
          >
            {water.place}
          </text>
        )}

        {points.map((item) => {
          const { x, y } = position(item);
          return (
            <g key={item.id}>
              <circle
                cx={x}
                cy={y}
                r={4}
                fill="var(--color-bg)"
                stroke="currentColor"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={x}
                y={y}
                dx="-0.9em"
                lang={item.lang}
                textAnchor="end"
                dominantBaseline="middle"
                className={LABEL}
                {...HALO}
              >
                {item.place}
              </text>
            </g>
          );
        })}

        <rect x={NOVA.x - 6} y={NOVA.y - 6} width={12} height={12} fill="currentColor" />
        <text
          x={NOVA.x}
          y={NOVA.y}
          dx="-0.9em"
          textAnchor="end"
          dominantBaseline="middle"
          className={cn(LABEL, "font-semibold")}
          {...HALO}
        >
          {site.shortName}
        </text>
      </svg>
    </div>
  );
}
