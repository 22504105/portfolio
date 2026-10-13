"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app/AppProvider";
import { fill } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STAGES = ["capture", "review", "assign"] as const;
export type ScanStage = (typeof STAGES)[number];

const backClass =
  "border-line bg-surface text-ink hover:bg-surface-2 absolute top-0 left-0 inline-flex size-11 items-center justify-center rounded-full border transition-colors";

/**
 * The top of each scanner screen, as Stitch draws it: a round button back,
 * the screen's name, which of the three steps this is, and a bar that fills
 * as they are done. The step is said in words; the bar only repeats it.
 */
export function ScanHeader({ title, stage, back }: { title: string; stage: ScanStage; back: string | (() => void) }) {
  const { t } = useApp();
  const at = STAGES.indexOf(stage);
  return (
    <header>
      <div className="relative flex min-h-11 flex-col items-center justify-center px-13 text-center">
        {typeof back === "string" ? (
          <Link href={back} aria-label={t.common.back} className={backClass}>
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
        ) : (
          <button type="button" onClick={back} aria-label={t.common.back} className={backClass}>
            <ArrowLeft aria-hidden="true" className="size-5" />
          </button>
        )}
        <h1 className="type-heading">{title}</h1>
        <p className="text-primary text-[0.8125rem] leading-5 font-medium">
          {fill(t.scan.step, { n: at + 1 })} • {t.scan.stages[stage]}
        </p>
      </div>
      <div aria-hidden="true" className="mt-3 grid grid-cols-3 gap-1.5">
        {STAGES.map((name, index) => (
          <span key={name} className={cn("h-1 rounded-full", index <= at ? "bg-primary" : "bg-surface-2")} />
        ))}
      </div>
    </header>
  );
}
