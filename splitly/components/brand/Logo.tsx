import { cn } from "@/lib/utils";

/** The mark from the concept: a white S on a deep green tile. Drawn here; no image file. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="#124436" />
      <path
        d="M21.3 11.9c-.7-2-2.600-3.200-5.200-3.200-3.100 0-5.200 1.600-5.200 4 0 5.100 10.400 2.600 10.400 7.200 0 2-1.900 3.400-5 3.400-2.900 0-4.900-1.200-5.700-3.400"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[1.25rem] font-semibold tracking-[-0.03em]", className)}>
      <LogoMark className={markClassName} />
      Splitly
    </span>
  );
}
