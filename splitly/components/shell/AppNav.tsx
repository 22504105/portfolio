"use client";

import { ChartColumn, Home, Plus, ReceiptText, Settings, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Key = "home" | "groups" | "analytics" | "receipts" | "profile" | "settings";
type Item = { key: Key; segment: string; icon: LucideIcon };

// The phone's bar, as in the concept: two places, the big plus, two places.
const BAR: readonly Item[] = [
  { key: "home", segment: "", icon: Home },
  { key: "groups", segment: "/groups", icon: UsersRound },
  { key: "analytics", segment: "/analytics", icon: ChartColumn },
  { key: "profile", segment: "/profile", icon: UserRound },
];

// The wide screen's column, as in the concept's browser version.
const RAIL: readonly Item[] = [
  { key: "home", segment: "", icon: Home },
  { key: "groups", segment: "/groups", icon: UsersRound },
  { key: "analytics", segment: "/analytics", icon: ChartColumn },
  { key: "receipts", segment: "/scan", icon: ReceiptText },
  { key: "settings", segment: "/profile", icon: Settings },
];

type AppNavProps = {
  /** Where the app lives, e.g. "/en/demo". */
  base: string;
  labels: Dictionary["nav"];
};

function useActive(base: string) {
  const pathname = usePathname();
  return (segment: string) =>
    segment === "" ? pathname === base : pathname === base + segment || pathname.startsWith(`${base}${segment}/`);
}

/**
 * The bar at the bottom of a phone: four places and, in the middle, the one
 * thing people come to do. It stays put while the page scrolls and keeps
 * clear of the phone's home indicator.
 */
export function BottomNav({ base, labels }: AppNavProps) {
  const active = useActive(base);
  const link = (item: Item) => {
    const current = active(item.segment);
    return (
      <li key={item.key} className="flex-1">
        <Link
          href={base + item.segment}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] transition-colors",
            // The current place is marked by weight and a filled icon as well as by colour.
            current ? "text-primary font-semibold" : "text-ink-muted hover:text-ink font-medium",
          )}
        >
          <item.icon
            aria-hidden="true"
            className="size-[1.375rem]"
            strokeWidth={current ? 2.5 : 1.9}
            fill={current ? "currentColor" : "none"}
            fillOpacity={current ? 0.18 : 0}
          />
          <span>{labels[item.key]}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label={labels.label}
      className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="h-nav mx-auto flex max-w-lg items-center px-2">
        {BAR.slice(0, 2).map(link)}
        <li className="flex w-18 shrink-0 justify-center">
          <Link
            href={`${base}/add`}
            aria-label={labels.add}
            aria-current={active("/add") ? "page" : undefined}
            className="bg-hero text-on-hero shadow-raised ring-surface -mt-7 flex size-14 items-center justify-center rounded-full ring-4 transition-transform hover:scale-105"
          >
            <Plus aria-hidden="true" className="size-6" strokeWidth={2.4} />
          </Link>
        </li>
        {BAR.slice(2).map(link)}
      </ul>
    </nav>
  );
}

/** The same places as a column on the deep green rail, for screens wide enough to spare the room. */
export function SideNav({ base, labels }: AppNavProps) {
  const active = useActive(base);
  return (
    <nav aria-label={labels.label} className="flex flex-col gap-1">
      {RAIL.map((item) => {
        const current = active(item.segment);
        return (
          <Link
            key={item.key}
            href={base + item.segment}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-control flex h-11 items-center gap-3 px-3.5 text-[0.9375rem] transition-colors",
              current ? "bg-white/12 font-semibold text-white" : "font-medium text-white/75 hover:bg-white/8 hover:text-white",
            )}
          >
            <item.icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={current ? 2.4 : 2} />
            {labels[item.key]}
          </Link>
        );
      })}
      <Link
        href={`${base}/add`}
        aria-current={active("/add") ? "page" : undefined}
        className="rounded-control mt-5 inline-flex h-11 items-center justify-center gap-2 bg-white px-4 text-[0.9375rem] font-semibold text-[#0E3A2E] transition-colors hover:bg-white/90"
      >
        <Plus aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.4} />
        {labels.add}
      </Link>
    </nav>
  );
}
