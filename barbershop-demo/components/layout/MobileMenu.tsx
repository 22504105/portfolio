"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { usePathname } from "@/i18n/navigation";
import { BOOK_HREF } from "@/lib/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { NavLinks } from "./NavLinks";

// The menu below `lg`. A native modal dialog: the browser traps focus inside
// it, makes the page behind inert, closes it on Escape and returns focus to
// the button that opened it.
export function MobileMenu() {
  const t = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = () => dialog.current?.close();

  // Arriving on another page closes the menu, whichever link led there.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="type-label inline-flex h-11 items-center gap-3 pl-3"
        onClick={() => dialog.current?.showModal()}
      >
        {t("nav.menu")}
        <span aria-hidden="true" className="flex w-6 flex-col gap-1.5">
          <span className="h-0.5 bg-fg" />
          <span className="h-0.5 bg-fg" />
        </span>
      </button>

      <dialog
        ref={dialog}
        aria-label={t("nav.menu")}
        className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-ink text-bone backdrop:bg-ink open:flex open:flex-col"
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <div className="flex h-header shrink-0 items-center justify-between border-b border-line px-gutter">
          <LocaleSwitcher />
          <button type="button" className="type-label inline-flex h-11 items-center gap-3 pl-3" onClick={close}>
            {t("nav.close")}
            <span aria-hidden="true" className="relative block size-5">
              <span className="absolute left-0 top-1/2 h-0.5 w-full rotate-45 bg-fg" />
              <span className="absolute left-0 top-1/2 h-0.5 w-full -rotate-45 bg-fg" />
            </span>
          </button>
        </div>

        <nav aria-label={t("nav.primary")} className="flex-1 overflow-y-auto px-gutter py-8">
          <NavLinks
            onNavigate={close}
            className="border-t border-line"
            linkClassName="type-h1 flex min-h-16 items-center border-b border-line py-3 aria-[current]:text-signal"
          />
        </nav>

        <div className="shrink-0 border-t border-line px-gutter py-6">
          <ButtonLink href={BOOK_HREF} variant="signal" size="lg" className="w-full" onClick={close}>
            {t("nav.bookAppointment")}
          </ButtonLink>
          <p className="type-small mt-4 text-muted">{t("brand.conceptShort")}</p>
        </div>
      </dialog>
    </div>
  );
}
