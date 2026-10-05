"use client";

import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DURATION, EASE, REVEAL_OFFSET } from "@/lib/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "p" | "article" | "dl";
  /**
   * `rise` for headings and text, `fade` for content that should not move
   * (figures, the map), `image` for the large photographs, which are unveiled
   * from the bottom edge upwards.
   */
  variant?: keyof typeof VARIANTS;
  /** Seconds to wait before entering; multiply STAGGER for sequences. */
  delay?: number;
};

const VARIANTS = {
  rise: { hidden: { opacity: 0, y: REVEAL_OFFSET }, shown: { opacity: 1, y: 0 } },
  fade: { hidden: { opacity: 0 }, shown: { opacity: 1 } },
  image: {
    hidden: { opacity: 0, clipPath: "inset(100% 0% 0% 0%)" },
    shown: { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
  },
} as const;

// The element is rendered hidden and shown once it scrolls into view. Content
// the reader has jumped past — by a link to a section further down — is shown
// at once, so nothing waits hidden above the viewport. The `data-reveal`
// hook lets app/layout.tsx show everything when JavaScript is off.
// Never wrap the hero image or headline: they must paint without waiting.
export function Reveal({
  children,
  className,
  as = "div",
  variant = "rise",
  delay = 0,
}: RevealProps) {
  const element = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"hidden" | "entering" | "passed">("hidden");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!element.current) return;
    // The observed area reaches far above the viewport, so an element counts
    // as seen whether it scrolls in or is jumped over.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState(entry.boundingClientRect.bottom < 0 ? "passed" : "entering");
        observer.disconnect();
      },
      { rootMargin: "100000px 0px -10% 0px" },
    );
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);

  // Every tag in `as` takes the same props; the cast spares a union of components.
  const Component = m[as] as typeof m.div;
  const { hidden, shown } = VARIANTS[variant];
  const enter = { duration: DURATION.slow, ease: EASE.out, delay };

  return (
    <Component
      ref={element}
      data-reveal=""
      className={className}
      initial={hidden}
      animate={state === "hidden" ? hidden : shown}
      transition={
        state === "passed"
          ? { duration: 0 }
          : {
              ...enter,
              // The unveiling is movement: with reduced motion the image only fades.
              clipPath: reduceMotion ? { duration: 0 } : enter,
              opacity: variant === "image" && !reduceMotion ? { duration: DURATION.fast, delay } : enter,
            }
      }
    >
      {children}
    </Component>
  );
}
