import type { CharacterId } from "./characters";
import { characters } from "./characters";
import { itemById, type Slot } from "./items";
import layers from "./layers.json";
import rig from "./rig.json";

// The hero drawn as layers: the base and each worn item's back and front parts, in draw order,
// placed by the species' fit (rig.json; the cuts are scripts/build-layers.mjs). Only what has
// verified art is drawn; a worn item without layers for this species is listed as pending, so a
// screen can say so instead of pretending. A species without a rig shows its plain base picture.

type LayerName = keyof typeof layers;
type Fit = { x: number; y: number; scale: number };

/** Back to front: cape_back behind the body, cape_front over it, then neck, then hat (the brief). */
const ORDER: { part: "back" | "front"; slot: Slot }[] = [
  { part: "back", slot: "outerwear" },
  { part: "back", slot: "neck" },
  { part: "back", slot: "headwear" },
  { part: "front", slot: "outerwear" },
  { part: "front", slot: "neck" },
  { part: "front", slot: "headwear" },
];

export type FigureLayer = { src: string; left: number; top: number; width: number; height: number };

export type Figure =
  | { kind: "layered"; aspect: number; layers: FigureLayer[]; drawn: string[]; pending: string[] }
  | { kind: "plain"; image: string; pending: string[] };

const [W, H] = rig.canvas;
const fitsOf = (species: CharacterId) => (rig.fits as Record<string, Record<string, Fit> | undefined>)[species];

function place(name: LayerName, fit: Fit): FigureLayer {
  const [left, top, width, height] = layers[name].box;
  // Percentages of the rig canvas, so the figure scales to any box with the canvas' aspect.
  return {
    src: `/images/layers/${name}.webp`,
    left: ((fit.x + left * fit.scale) / W) * 100,
    top: ((fit.y + top * fit.scale) / H) * 100,
    width: ((width * fit.scale) / W) * 100,
    height: ((height * fit.scale) / H) * 100,
  };
}

export function figureOf(species: CharacterId, equipped: Partial<Record<Slot, string | null>>): Figure {
  const worn = Object.values(equipped).filter((id): id is string => !!id && itemById.has(id));
  const fits = fitsOf(species);
  const baseLayer = `${species}-base` as LayerName;
  if (!fits || !(baseLayer in layers)) return { kind: "plain", image: characters[species].image, pending: worn };

  const drawable = (slot: Slot) => {
    const id = equipped[slot];
    const art = id ? itemById.get(id)?.art : undefined;
    return art && fits[art] ? { id: id!, art } : null;
  };
  const stack: FigureLayer[] = [];
  const add = (part: "back" | "front", slot: Slot) => {
    const found = drawable(slot);
    const name = found && (`${found.art}-${part}` as LayerName);
    if (found && name && name in layers) stack.push(place(name, fits[found.art]));
  };
  for (const step of ORDER.filter((s) => s.part === "back")) add(step.part, step.slot);
  stack.push(place(baseLayer, fits.base));
  for (const step of ORDER.filter((s) => s.part === "front")) add(step.part, step.slot);

  const drawn = worn.filter((id) => {
    const item = itemById.get(id)!;
    return !!drawable(item.slot);
  });
  return { kind: "layered", aspect: W / H, layers: stack, drawn, pending: worn.filter((id) => !drawn.includes(id)) };
}
