"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Transparent over the hero sky at the very top of the page, a solid bar from
// the first scroll onwards. Children follow the state with the
// `group-data-scrolled/header:` variant. The sentinel marks "the very top": an observer on
// it replaces a scroll listener.
export function HeaderShell({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="pointer-events-none absolute top-0 h-6 w-px" />
      <header
        data-tone="base"
        data-scrolled={scrolled ? "" : undefined}
        className={
          "group/header fixed inset-x-0 top-0 z-(--z-header) h-header border-b border-transparent text-ink " +
          "transition-colors duration-(--duration-base) ease-quiet " +
          "data-scrolled:border-line data-scrolled:bg-bg"
        }
      >
        {children}
      </header>
    </>
  );
}
