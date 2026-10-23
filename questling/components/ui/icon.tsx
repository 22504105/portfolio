// A Material Symbol, drawn by the subset icon font in public/fonts (scripts/build-icons.mjs),
// as the Stitch exports draw them: the name is a ligature, `filled` is FILL 1.
// Size it with a text size (`text-[22px]`), colour it with a text colour.
export function Icon({ name, filled = false, className }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      translate="no"
      className={className ? `material-symbols-outlined ${className}` : "material-symbols-outlined"}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}
