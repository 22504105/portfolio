"use client";

import { animate, AnimatePresence, useMotionValue } from "motion/react";
import * as m from "motion/react-m";
import Image from "next/image";
import { createContext, useContext, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { CloseButton } from "@/components/ui/CloseButton";
import { Dialog } from "@/components/ui/Dialog";
import type { GalleryItem } from "@/data/types";
import { twoDigits } from "@/lib/format";
import { DURATION, EASE, REVEAL_OFFSET } from "@/lib/motion";

/** +1 towards the next photograph, -1 towards the previous one. */
type Direction = 1 | -1;

/** Horizontal travel, in pixels, after which a released drag turns the page. */
const SWIPE_DISTANCE = 56;

const CONTROL =
  "type-label inline-flex h-12 items-center gap-2 px-3 " +
  "transition-opacity duration-(--duration-fast) hover:opacity-60";

const OpenContext = createContext<((index: number) => void) | null>(null);

type SlideProps = {
  item: GalleryItem;
  /** The side this photograph comes in from. */
  direction: Direction;
  onSwipe: (direction: Direction) => void;
};

// One photograph on the stage. It follows the finger or the mouse sideways;
// vertical gestures are left to the browser (`touch-action`), which then
// cancels the pointer and the photograph settles back.
function Slide({ item, direction, onSwipe }: SlideProps) {
  const x = useMotionValue(0);
  const dragStart = useRef<number | null>(null);

  const settle = () => {
    dragStart.current = null;
    animate(x, 0, { duration: DURATION.base, ease: EASE.out });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current !== null) x.set(event.clientX - dragStart.current);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const travel = event.clientX - dragStart.current;
    if (Math.abs(travel) < SWIPE_DISTANCE) settle();
    else {
      dragStart.current = null;
      onSwipe(travel < 0 ? 1 : -1);
    }
  };

  return (
    <m.div
      className="absolute inset-0 flex touch-pan-y touch-pinch-zoom items-center justify-center lg:px-gutter"
      style={{ x }}
      initial={{ opacity: 0, x: direction * REVEAL_OFFSET }}
      animate={{ opacity: 1, x: 0 }}
      // It fades where it was let go rather than travelling back to the centre.
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE.inOut }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={settle}
    >
      {/* Never larger than the file: `w-auto` keeps it at its own width or less. */}
      <Image
        src={item.image.src}
        alt={item.image.alt}
        sizes="100vw"
        placeholder="blur"
        draggable={false}
        className="h-auto max-h-full w-auto max-w-full select-none"
      />
    </m.div>
  );
}

type GalleryLightboxProps = {
  /** The gallery grid, whose GalleryTrigger buttons open the lightbox. */
  children: ReactNode;
  items: GalleryItem[];
  labels: { title: string; previous: string; next: string };
};

export function GalleryLightbox({ children, items, labels }: GalleryLightboxProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ index: number; direction: Direction }>({ index: 0, direction: 1 });
  const item = items[view.index];

  const show = (index: number) => {
    setView({ index, direction: 1 });
    setOpen(true);
  };

  // The gallery is a loop: the last photograph leads back to the first.
  const turn = (direction: Direction) =>
    setView((current) => ({
      index: (current.index + direction + items.length) % items.length,
      direction,
    }));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") turn(1);
    else if (event.key === "ArrowLeft") turn(-1);
  };

  return (
    <OpenContext value={show}>
      {children}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        tone="inverse"
        label={labels.title}
        onKeyDown={onKeyDown}
        className="flex flex-col bg-bg"
      >
        <div className="flex h-header shrink-0 items-center justify-between px-gutter">
          <p className="type-eyebrow tabular-nums">
            {twoDigits(view.index + 1)}
            <span className="text-ink-muted"> / {twoDigits(items.length)}</span>
          </p>
          <CloseButton onClick={() => setOpen(false)} />
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false}>
            <Slide key={item.id} item={item} direction={view.direction} onSwipe={turn} />
          </AnimatePresence>
        </div>

        <div className="flex h-header shrink-0 items-center justify-between gap-6 px-gutter">
          <p aria-live="polite" className="type-eyebrow">
            {item.caption}
          </p>
          <div className="-mr-3 flex">
            <button type="button" className={CONTROL} onClick={() => turn(-1)}>
              <span aria-hidden="true">←</span>
              {labels.previous}
            </button>
            <button type="button" className={CONTROL} onClick={() => turn(1)}>
              {labels.next}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </Dialog>
    </OpenContext>
  );
}

type GalleryTriggerProps = {
  children: ReactNode;
  /** Position of the photograph in the gallery. */
  index: number;
  label: string;
  className?: string;
};

export function GalleryTrigger({ children, index, label, className }: GalleryTriggerProps) {
  const show = useContext(OpenContext);

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      className={className}
      onClick={() => show?.(index)}
    >
      {children}
    </button>
  );
}
