"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useLayoutEffect, useRef } from "react";
import type { KeyboardEventHandler, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";

type DialogProps = {
  children: ReactNode;
  open: boolean;
  /** Asked to close: Escape, the Android back gesture or a click on the scrim. */
  onClose: () => void;
  /** Runs once the exit has played, the dialog is closed and focus is back on the page. */
  onExited?: () => void;
  tone: "base" | "inverse";
  /** Name the dialog with one of these. */
  label?: string;
  labelledBy?: string;
  /** Dims the page behind a panel that does not cover it; a click on it closes. */
  scrim?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
  /** Styles the full-screen layer that holds the content. */
  className?: string;
};

const OPEN = { duration: DURATION.slow, ease: EASE.inOut };
const CLOSE = { duration: DURATION.base, ease: EASE.inOut };

/** For panels inside a Dialog that move as well as fade. */
export const DIALOG_TRANSITION = { open: OPEN, close: CLOSE } as const;

// A native modal dialog — the browser provides the focus trap, the inert page
// and the return of focus — that stays open until its content has faded out.
// It sits in the top layer, outside the page's tones, so it sets its own.
export function Dialog({
  children,
  open,
  onClose,
  onExited,
  tone,
  label,
  labelledBy,
  scrim = false,
  onKeyDown,
  className,
}: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    if (!open || dialog.current?.open) return;
    dialog.current?.showModal();
    // Focus starts on the close control, the first button of every dialog.
    // Left to itself Chrome picks a scrolling panel when there is one.
    dialog.current?.querySelector("button")?.focus();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      data-tone={tone}
      aria-label={label}
      aria-labelledby={labelledBy}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent text-ink backdrop:bg-transparent"
      onKeyDown={onKeyDown}
      // Escape closes through the same exit instead of cutting it short.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Chrome closes on a second Escape whatever `cancel` does; keep in step.
      onClose={onClose}
    >
      <AnimatePresence
        onExitComplete={() => {
          dialog.current?.close();
          onExited?.();
        }}
      >
        {open && (
          <m.div
            className={cn("relative size-full", className)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: OPEN }}
            exit={{ opacity: 0, transition: CLOSE }}
          >
            {scrim && (
              <div aria-hidden="true" className="absolute inset-0 bg-ink/70" onClick={onClose} />
            )}
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}
