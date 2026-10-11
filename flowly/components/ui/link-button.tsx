import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-input font-medium whitespace-nowrap transition-colors duration-200 [&_svg]:size-4 [&_svg]:shrink-0";

const variants = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  outline: "border border-input bg-surface text-ink hover:bg-surface-2",
  // For dark surfaces.
  inverse: "border border-white/20 text-nav-ink hover:bg-white/10",
  ghost: "text-ink hover:bg-surface-2",
} as const;

const sizes = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[0.9375rem]",
} as const;

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: keyof typeof variants; size?: keyof typeof sizes };

/** A link that looks like a button: for going somewhere. Actions use Button. */
export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
