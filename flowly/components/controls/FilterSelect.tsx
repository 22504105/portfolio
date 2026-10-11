"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { hrefWith, type SearchParams } from "@/lib/view/state";

type FilterSelectProps = {
  /** The parameter this menu sets in the address. */
  name: string;
  label: string;
  value: string | null;
  options: readonly string[];
  allLabel: string;
  pathname: string;
  params: SearchParams;
};

/** A menu that filters by one value. Choosing changes the address; the page follows. */
export function FilterSelect({ name, label, value, options, allLabel, pathname, params }: FilterSelectProps) {
  const router = useRouter();
  const id = useId();
  // A value from the address that the workspace does not have is still shown, so it can be seen and removed.
  const known = value === null || options.includes(value);

  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => router.push(hrefWith(pathname, params, { [name]: event.target.value }), { scroll: false })}
        className={cn(
          "rounded-input bg-surface text-ink hover:bg-surface-2 h-10 w-full max-w-56 min-w-36 cursor-pointer appearance-none truncate border py-0 pr-9 pl-3 transition-colors",
          value === null ? "border-input" : "border-brand/50 bg-brand-tint text-brand-hover hover:bg-brand-tint font-medium",
        )}
      >
        <option value="">
          {label}: {allLabel}
        </option>
        {!known && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="text-ink-muted pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </div>
  );
}
