import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = {
  children: ReactNode;
  id?: string;
  /** Id of the heading that names this section. */
  labelledBy?: string;
  tone?: "base" | "surface" | "inverse";
  space?: "none" | "sm" | "md" | "lg";
  className?: string;
};

const SPACE = {
  none: "",
  sm: "py-section-sm",
  md: "py-section-md",
  lg: "py-section-lg",
} as const;

export function Section({
  children,
  id,
  labelledBy,
  tone = "base",
  space = "md",
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-tone={tone}
      className={cn("bg-bg text-ink", SPACE[space], className)}
    >
      {children}
    </section>
  );
}
