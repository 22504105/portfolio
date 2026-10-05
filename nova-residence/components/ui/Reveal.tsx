"use client";

import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { DURATION, EASE, REVEAL_OFFSET } from "@/lib/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before entering; multiply STAGGER for sequences. */
  delay?: number;
  /** Vertical travel in pixels. Pass 0 for a pure fade. */
  y?: number;
};

// The element is rendered hidden and shown once it scrolls into view. The
// `data-reveal` hook lets app/layout.tsx show it when JavaScript is off.
// Never wrap the hero image or headline: they must paint without waiting.
export function Reveal({
  children,
  className,
  delay = 0,
  y = REVEAL_OFFSET,
}: RevealProps) {
  return (
    <m.div
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: "some", margin: "0px 0px -10% 0px" }}
      transition={{ duration: DURATION.slow, ease: EASE.out, delay }}
    >
      {children}
    </m.div>
  );
}
