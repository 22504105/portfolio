import { cn } from "@/lib/utils";

/** The mark: three streams joining into one. Drawn here; no image file. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)} fill="none" strokeLinecap="round" strokeWidth="2.4">
      <path d="M3 6c5 0 6 6 11 6h7" stroke="currentColor" opacity="0.55" />
      <path d="M3 18c5 0 6-6 11-6" stroke="currentColor" opacity="0.55" />
      <path d="M3 12h18" stroke="var(--accent-base)" />
    </svg>
  );
}

/** The mark with the wordmark "flowly." beside it. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[1.3125rem] font-semibold tracking-[-0.04em]", className)}>
      <LogoMark />
      <span>
        flowly<span className="text-brand">.</span>
      </span>
    </span>
  );
}
