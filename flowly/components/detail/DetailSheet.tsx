"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type DetailSheetProps = {
  title: string;
  description: string;
  /** The address without the drawer: where closing leads. */
  closeHref: string;
  children: ReactNode;
};

/**
 * A drawer for the details of one order or one customer. It is open because
 * the address says so; closing it goes to the address that does not.
 */
export function DetailSheet({ title, description, closeHref, children }: DetailSheetProps) {
  const router = useRouter();
  // On opening, focus goes to the title, so a screen reader starts with what the drawer is about and
  // no link inside looks selected.
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <Sheet open onOpenChange={(open) => !open && router.push(closeHref, { scroll: false })}>
      <SheetContent
        side="right"
        initialFocus={heading}
        className="bg-canvas w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[34rem]"
      >
        <SheetHeader className="border-line bg-surface border-b px-6 py-5 pr-14">
          <SheetDescription className="type-label text-ink-muted">{description}</SheetDescription>
          <SheetTitle ref={heading} tabIndex={-1} className="type-page text-[1.5rem] outline-none">
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-6 py-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
