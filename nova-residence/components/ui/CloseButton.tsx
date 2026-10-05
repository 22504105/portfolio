import type { ComponentProps } from "react";
import { controls } from "@/data/site";

// The close control of every overlay: a label and a cross of two hairlines.
export function CloseButton(props: Omit<ComponentProps<"button">, "type" | "className" | "children">) {
  return (
    <button
      type="button"
      className="type-label -mr-3 inline-flex h-12 items-center gap-3 px-3 transition-opacity duration-(--duration-fast) hover:opacity-60"
      {...props}
    >
      {controls.close}
      <span aria-hidden="true" className="relative size-6">
        <span className="absolute inset-x-0 top-1/2 h-px rotate-45 bg-ink" />
        <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-ink" />
      </span>
    </button>
  );
}
