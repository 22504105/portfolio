import { Car, House, Popcorn, Receipt, ShoppingBasket, Utensils, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

// Each kind of expense has its own picture and tint, as in the concept. The
// tints are fixed pairs (a soft fill and a darker mark of the same hue) that
// read on both themes; the category's name is always written beside the tile.

export const CATEGORY_LOOK: Record<Category | "none", { icon: LucideIcon; fill: string; mark: string }> = {
  food: { icon: Utensils, fill: "#FBE3D6", mark: "#C2552B" },
  groceries: { icon: ShoppingBasket, fill: "#FDEFC8", mark: "#A8760B" },
  transport: { icon: Car, fill: "#DDE6FA", mark: "#3F5FB0" },
  lodging: { icon: House, fill: "#E4E1F7", mark: "#5B4FB3" },
  fun: { icon: Popcorn, fill: "#F9DDE0", mark: "#B5475A" },
  other: { icon: Receipt, fill: "#E3F3E8", mark: "#1B6B4C" },
  none: { icon: Receipt, fill: "#E3F3E8", mark: "#1B6B4C" },
};

export function CategoryIcon({ category, className, round = false }: { category: Category | null; className?: string; round?: boolean }) {
  const look = CATEGORY_LOOK[category ?? "none"];
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-11 shrink-0 items-center justify-center", round ? "rounded-full" : "rounded-[12px]", className)}
      style={{ backgroundColor: look.fill, color: look.mark }}
    >
      <look.icon className="size-5" strokeWidth={2.2} />
    </span>
  );
}
