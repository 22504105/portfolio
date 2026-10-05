"use client";

import * as m from "motion/react-m";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { Container } from "@/components/ui/Container";
import { Dialog } from "@/components/ui/Dialog";
import { navigation } from "@/data/navigation";
import { controls, cta, site } from "@/data/site";
import { DURATION, EASE, REVEAL_OFFSET, STAGGER } from "@/lib/motion";

/** Where the desktop navigation takes over: Tailwind's `lg`. */
const DESKTOP = "(min-width: 64rem)";

const TRIGGER =
  "type-label -mr-3 inline-flex h-12 items-center gap-3 px-3 " +
  "transition-opacity duration-(--duration-fast) hover:opacity-60";

// The links follow the overlay in, one after another.
const LIST = {
  hidden: {},
  shown: { transition: { delayChildren: DURATION.fast, staggerChildren: STAGGER } },
};

const ITEM = {
  hidden: { opacity: 0, y: REVEAL_OFFSET },
  shown: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.out } },
};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  // The section to move on to once the menu has closed.
  const destination = useRef<string | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP);
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const { hash } = event.currentTarget;
    destination.current = hash;
    // The page moves at once behind the menu, which then fades to reveal it.
    document.querySelector(hash)?.scrollIntoView({ behavior: "instant" });
    setOpen(false);
  };

  return (
    <>
      {/* Only the trigger is hidden on desktop: hiding an open dialog would leave the page inert. */}
      <div className="lg:hidden">
        <button
          type="button"
          className={TRIGGER}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          {controls.menu}
          <span aria-hidden="true" className="grid w-6 gap-1.5">
            <span className="h-px bg-ink" />
            <span className="h-px bg-ink" />
          </span>
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        onExited={() => {
          // Focus is back on the trigger, at the top of the page: move it on to
          // the section, so the keyboard and screen readers continue from there.
          const hash = destination.current;
          destination.current = null;
          if (!hash) return;
          window.location.hash = hash;
          document.querySelector<HTMLElement>(hash)?.focus({ preventScroll: true });
        }}
        tone="inverse"
        label={controls.menu}
        className="overflow-y-auto overscroll-contain bg-bg"
      >
        <Container className="flex min-h-full flex-col pb-10">
          <div className="flex h-header shrink-0 items-center justify-between">
            <span className="type-brand">{site.shortName}</span>
            <CloseButton onClick={() => setOpen(false)} />
          </div>

          <nav aria-label="Primary" className="mt-10">
            <m.ul className="border-t border-line" variants={LIST} initial="hidden" animate="shown">
              {navigation.map((item) => (
                <m.li key={item.href} className="border-b border-line" variants={ITEM}>
                  <a href={item.href} className="type-h2 block py-5" onClick={follow}>
                    {item.label}
                  </a>
                </m.li>
              ))}
            </m.ul>
          </nav>

          <div className="mt-auto pt-12">
            <Button href={cta.viewing.href} size="lg" className="w-full" onClick={follow}>
              {cta.viewing.label}
            </Button>
            <p className="type-small mt-8 flex justify-between gap-4 text-ink-muted">
              <span>{site.location}</span>
              <span>{site.disclosure.short}</span>
            </p>
          </div>
        </Container>
      </Dialog>
    </>
  );
}
