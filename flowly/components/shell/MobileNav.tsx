"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Messages } from "@/lib/i18n";
import type { WorkspaceRoot } from "@/lib/routes";
import { NavLinks } from "./NavLinks";

type MobileNavProps = { root: WorkspaceRoot; labels: Messages["nav"]; workspaceName: string };

/** The navigation on a phone: a drawer opened from the top bar. */
export function MobileNav({ root, labels, workspaceName }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={labels.open}
        className="rounded-input border-line bg-surface text-ink hover:bg-surface-2 inline-flex size-11 items-center justify-center border transition-colors md:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="on-nav bg-nav text-nav-ink [&_[data-slot=sheet-close]]:text-nav-ink w-[min(20rem,86vw)] gap-0 border-0 p-4"
      >
        <SheetHeader className="mb-6 p-0 px-1 pt-1">
          <SheetTitle className="sr-only">{labels.title}</SheetTitle>
          <SheetDescription className="sr-only">{workspaceName}</SheetDescription>
          <Link href="/" aria-label={labels.home} onClick={close} className="inline-flex h-11 items-center self-start text-white">
            <Logo />
          </Link>
        </SheetHeader>
        <NavLinks root={root} labels={labels} onNavigate={close} />
      </SheetContent>
    </Sheet>
  );
}
