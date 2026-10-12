import { cn } from "@/lib/utils";

/** The mark: a coin cut cleanly in two. Drawn here; no image file. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M16 7a9 9 0 0 0 0 18z" fill="var(--on-primary)" />
      <path d="M18.5 8.4a9 9 0 0 1 0 15.2z" fill="var(--on-primary)" opacity="0.55" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[1.25rem] font-semibold tracking-[-0.03em]", className)}>
      <LogoMark />
      Splitly
    </span>
  );
}
