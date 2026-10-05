"use client";

import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { navigation } from "@/data/navigation";
import { cta, site } from "@/data/site";

const TRIGGER = "type-label -mr-3 inline-flex h-12 items-center gap-3 px-3";

// A native modal dialog: the browser provides the focus trap, Escape and the
// inert page behind it.
export function MobileNav() {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      {/* Only the trigger is hidden on desktop: hiding an open dialog would leave the page inert. */}
      <div className="lg:hidden">
        <button
          type="button"
          className={TRIGGER}
          aria-haspopup="dialog"
          onClick={() => dialog.current?.showModal()}
        >
          Menu
          <span aria-hidden="true" className="grid w-6 gap-1.5">
            <span className="h-px bg-ink" />
            <span className="h-px bg-ink" />
          </span>
        </button>
      </div>

      {/* The dialog leaves the page's tones, so it sets its own. */}
      <dialog
        ref={dialog}
        data-tone="inverse"
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-bg text-ink"
      >
        <Container className="flex min-h-full flex-col pb-10">
          <div className="flex h-header shrink-0 items-center justify-between">
            <span className="type-brand">{site.shortName}</span>
            <button type="button" className={TRIGGER} onClick={close}>
              Close
              <span aria-hidden="true" className="relative size-6">
                <span className="absolute inset-x-0 top-1/2 h-px rotate-45 bg-ink" />
                <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-ink" />
              </span>
            </button>
          </div>

          <nav aria-label="Primary" className="mt-10">
            <ul className="border-t border-line">
              {navigation.map((item) => (
                <li key={item.href} className="border-b border-line">
                  <Link href={item.href} className="type-h2 block py-5" onClick={close}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto pt-12">
            <Button href={cta.viewing.href} size="lg" className="w-full" onClick={close}>
              {cta.viewing.label}
            </Button>
            <p className="type-small mt-8 flex justify-between gap-4 text-ink-muted">
              <span>{site.location}</span>
              <span>{site.disclosure.short}</span>
            </p>
          </div>
        </Container>
      </dialog>
    </>
  );
}
