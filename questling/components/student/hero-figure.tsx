/* eslint-disable @next/next/no-img-element -- layers are pre-sized WebP with alpha in public/images/layers (scripts/build-layers.mjs) */
import type { CharacterId } from "@/lib/content/characters";
import { figureOf } from "@/lib/content/figure";
import type { Slot } from "@/lib/content/items";

// The hero, full body: the base and the worn items' layers stacked in draw order (lib/content/figure.ts),
// or the plain base picture for a hero without fitted layers yet. `className` sizes it (give it a
// height); the width follows the rig's aspect. Wardrobe, shop, inventory and profile all draw it.
export function HeroFigure({
  species,
  equipped,
  alt,
  className = "",
  plainClassName = "",
}: {
  species: CharacterId;
  equipped: Partial<Record<Slot, string | null>>;
  alt: string;
  className?: string;
  /** Classes for the plain picture of a hero without layers (the screens' own image classes). */
  plainClassName?: string;
}) {
  const figure = figureOf(species, equipped);
  if (figure.kind === "plain") return <img alt={alt} className={plainClassName || className} src={figure.image} />;
  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative ${className}`}
      style={{ aspectRatio: figure.aspect }}
      data-figure-layers={figure.layers.length}
    >
      {figure.layers.map((layer) => (
        <img
          key={layer.src}
          alt=""
          draggable={false}
          src={layer.src}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: `${layer.left}%`, top: `${layer.top}%`, width: `${layer.width}%`, height: `${layer.height}%` }}
        />
      ))}
    </div>
  );
}
