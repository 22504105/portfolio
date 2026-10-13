import {
  Apple,
  Baby,
  Bath,
  Beef,
  Beer,
  Candy,
  Carrot,
  Cigarette,
  Coffee,
  Croissant,
  CupSoda,
  Drumstick,
  Egg,
  Fish,
  Fuel,
  GlassWater,
  IceCreamCone,
  Milk,
  PawPrint,
  Pill,
  Pizza,
  ShoppingBag,
  Soup,
  SprayCan,
  Ticket,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { FAMILY_OF, pictureOf, type Family, type Picture } from "@/lib/receipt/pictures";
import { cn } from "@/lib/utils";

// The picture beside a line of a receipt: a drawn icon on a tinted tile,
// chosen by the words of the line's name (lib/receipt/pictures.ts). Kept in
// the site itself: nothing is loaded from anywhere. A name nothing matches
// gets the shopping bag. Decoration only: the name is always written beside it.

const ICON: Record<Picture, LucideIcon> = {
  milk: Milk,
  bread: Croissant,
  eggs: Egg,
  chicken: Drumstick,
  meat: Beef,
  fish: Fish,
  fruit: Apple,
  vegetables: Carrot,
  grains: Wheat,
  water: GlassWater,
  softDrink: CupSoda,
  coffee: Coffee,
  beer: Beer,
  wine: Wine,
  sweets: Candy,
  iceCream: IceCreamCone,
  pizza: Pizza,
  meal: Soup,
  cleaning: SprayCan,
  hygiene: Bath,
  pharmacy: Pill,
  baby: Baby,
  pet: PawPrint,
  tobacco: Cigarette,
  fuel: Fuel,
  ticket: Ticket,
  other: ShoppingBag,
};

// Fixed pairs, as for categories: a soft fill and a darker mark of the same hue, readable on both themes.
const TINT: Record<Family, { fill: string; mark: string }> = {
  dairy: { fill: "#DDE6FA", mark: "#3F5FB0" },
  bakery: { fill: "#FDEFC8", mark: "#A8760B" },
  meat: { fill: "#F9DDE0", mark: "#B5475A" },
  produce: { fill: "#DDF1DC", mark: "#2F7A3B" },
  drinks: { fill: "#D8EEF3", mark: "#1F6F85" },
  sweets: { fill: "#FBE3D6", mark: "#C2552B" },
  home: { fill: "#E4E1F7", mark: "#5B4FB3" },
  other: { fill: "#E3F3E8", mark: "#1B6B4C" },
};

export function ProductIcon({ label, className }: { label: string; className?: string }) {
  const picture = pictureOf(label);
  const Icon = ICON[picture];
  const tint = TINT[FAMILY_OF[picture]];
  return (
    <span
      aria-hidden="true"
      data-picture={picture}
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-[12px]", className)}
      style={{ backgroundColor: tint.fill, color: tint.mark }}
    >
      <Icon className="size-5" strokeWidth={2.2} />
    </span>
  );
}
