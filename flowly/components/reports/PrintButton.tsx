"use client";

import { Printer } from "lucide-react";

/** Opens the browser's own print window, which is also how a PDF is saved: no server and no library involved. */
export function PrintButton({ label, hint }: { label: string; hint: string }) {
  return (
    <button
      type="button"
      title={hint}
      onClick={() => window.print()}
      className="rounded-input bg-brand hover:bg-brand-strong inline-flex h-10 items-center gap-2 px-4 font-medium text-white transition-colors"
    >
      <Printer aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
