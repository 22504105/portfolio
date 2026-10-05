import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type TextLinkStyleProps = {
  children: ReactNode;
  /** Adds a trailing arrow that moves on hover — for calls to action. */
  arrow?: boolean;
  className?: string;
};

type TextLinkAsLink = TextLinkStyleProps &
  Omit<ComponentProps<"a">, keyof TextLinkStyleProps> & {
    href: string;
  };

// Without `href` it renders a button — for actions such as opening a dialog.
type TextLinkAsButton = TextLinkStyleProps &
  Omit<ComponentProps<"button">, keyof TextLinkStyleProps> & {
    href?: undefined;
  };

type TextLinkProps = TextLinkAsLink | TextLinkAsButton;

// Vertical padding gives the link a comfortable hit area without moving it.
const CLASSES = "type-label group -my-2 inline-flex items-baseline gap-2 py-2 text-ink";

const LABEL =
  "underline decoration-line-strong decoration-1 underline-offset-[0.5em] " +
  "transition-colors duration-(--duration-fast) group-hover:decoration-ink";

const ARROW =
  "transition-transform duration-(--duration-base) ease-quiet group-hover:translate-x-1";

export function TextLink({ children, arrow = false, className, ...props }: TextLinkProps) {
  const classes = cn(CLASSES, className);
  const content = (
    <>
      <span className={LABEL}>{children}</span>
      {arrow && (
        <span aria-hidden="true" className={ARROW}>
          →
        </span>
      )}
    </>
  );

  if (props.href === undefined) {
    return (
      <button type="button" className={classes} {...props}>
        {content}
      </button>
    );
  }

  if (/^https?:\/\//.test(props.href)) {
    return (
      <a target="_blank" rel="noopener noreferrer" className={classes} {...props}>
        {content}
      </a>
    );
  }

  return (
    <Link className={classes} {...props}>
      {content}
    </Link>
  );
}
