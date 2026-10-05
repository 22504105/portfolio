import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonStyleProps = {
  children: ReactNode;
  variant?: "solid" | "outline";
  size?: "md" | "lg";
  className?: string;
};

type ButtonAsLink = ButtonStyleProps &
  Omit<ComponentProps<typeof Link>, keyof ButtonStyleProps> & {
    href: string;
  };

type ButtonAsButton = ButtonStyleProps &
  Omit<ComponentProps<"button">, keyof ButtonStyleProps> & {
    href?: undefined;
  };

type ButtonProps = ButtonAsLink | ButtonAsButton;

// Unavailable controls drop to a quiet outline. `aria-disabled` gets the same
// treatment so a submit button can stay focusable while a request is running.
const BASE =
  "type-label inline-flex items-center justify-center gap-3 border whitespace-nowrap " +
  "transition-colors duration-(--duration-base) ease-quiet active:opacity-80 " +
  "aria-busy:cursor-progress " +
  "disabled:pointer-events-none disabled:border-line disabled:bg-transparent disabled:text-ink-muted " +
  "aria-disabled:pointer-events-none aria-disabled:border-line aria-disabled:bg-transparent aria-disabled:text-ink-muted";

// Both variants swap fill and outline on hover, so the pair always reads as
// one family whichever tone they sit in.
const VARIANT = {
  solid: "border-ink bg-ink text-bg hover:bg-transparent hover:text-ink",
  outline: "border-line-strong text-ink hover:border-ink hover:bg-ink hover:text-bg",
} as const;

const SIZE = {
  md: "h-12 px-7",
  lg: "h-14 px-9",
} as const;

export function Button({
  children,
  variant = "solid",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const classes = cn(BASE, VARIANT[variant], SIZE[size], className);

  if (props.href !== undefined) {
    return (
      <Link className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
