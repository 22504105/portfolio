import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type Variant = "signal" | "solid" | "outline";
type Size = "md" | "lg";

const BASE =
  "type-label inline-flex items-center justify-center gap-3 text-center transition-colors duration-(--duration-fast) " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-45 disabled:cursor-not-allowed disabled:opacity-45";

const VARIANTS: Record<Variant, string> = {
  // The one loud thing on a screen.
  signal: "bg-signal text-ink hover:bg-bone",
  solid: "bg-fg text-bg hover:bg-signal hover:text-ink",
  outline: "border border-fg text-fg hover:bg-fg hover:text-bg",
};

const SIZES: Record<Size, string> = {
  md: "min-h-12 px-6 py-3",
  lg: "min-h-14 px-8 py-4",
};

const classes = (variant: Variant, size: Size, className = "") =>
  `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

type Common = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
};

type ButtonProps = Common & Omit<ComponentProps<"button">, "className" | "children">;

export function Button({ children, variant = "solid", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={classes(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

type ButtonLinkProps = Common & Omit<ComponentProps<typeof Link>, "className" | "children">;

/** A link that looks like a button, for moving between pages. */
export function ButtonLink({ children, variant = "solid", size = "md", className, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

type TextLinkProps = Omit<ComponentProps<typeof Link>, "className"> & { className?: string };

/** An underlined link with an arrow, for "see more" at the end of a section. */
export function ArrowLink({ children, className = "", ...rest }: TextLinkProps) {
  return (
    <Link
      className={`type-label group inline-flex min-h-11 items-center gap-3 border-b border-fg pb-1 transition-colors duration-(--duration-fast) hover:border-signal hover:text-signal ${className}`}
      {...rest}
    >
      {children}
      <span aria-hidden="true" className="transition-transform duration-(--duration-fast) group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
