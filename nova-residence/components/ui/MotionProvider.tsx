"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Loads the animation features once for the whole page. `strict` makes any use
// of the full `motion` component an error, so every animated element goes
// through the lightweight `m` component (import * as m from "motion/react-m").
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
