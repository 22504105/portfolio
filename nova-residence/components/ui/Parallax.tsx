"use client";

import { useReducedMotion, useScroll, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ParallaxProps = {
  /** Must fill its parent: pass a Photo with `h-full`. */
  children: ReactNode;
  /** Sets the frame: give it an aspect ratio or a height. */
  className?: string;
};

// The frame scrolls with the page while its content, 8% taller than the frame,
// drifts 7% of its own height the other way. For two or three large
// photographs at most. The travel starts at zero so the server and the first
// client render agree whatever the reader's motion setting.
export function Parallax({ children, className }: ParallaxProps) {
  const frame = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "7%"]);

  return (
    <div ref={frame} className={cn("relative overflow-hidden", className)}>
      <m.div className="absolute inset-x-0 -top-[8%] bottom-0" style={{ y }}>
        {children}
      </m.div>
    </div>
  );
}
