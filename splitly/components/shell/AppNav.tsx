"use client";

import { Activity, Home, Plus, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Item = { key: "home" | "groups" | "activity" | "profile"; segment: string; icon: LucideIcon };

const ITEMS: readonly Item[] = [
  { key: "home", segment: "", icon: Home },
  { key: "groups", segment: "/groups", icon: UsersRound },
  { key: "activity", segment: "/activity", icon: Activity },
  { key: "profile", segment: "/profile", icon: UserRound },
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
            "rounded-control flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors",
            current ? "text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          {/* The current place is marked by a filled pill behind its icon and by weight, not by colour alone. */}
          <span
            className={cn(
              "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
              current && "bg-accent text-on-accent",
            )}
          >
            <item.icon aria-hidden="true" className="size-5" strokeWidth={current ? 2.4 : 2} />
          </span>
          <span className={cn(current && "font-semibold")}>{labels[item.key]}</span>
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
        {ITEMS.slice(0, 2).map(link)}
        <li className="flex w-18 shrink-0 justify-center">
          <Link
            href={`${base}/add`}
            aria-label={labels.add}
            aria-current={active("/add") ? "page" : undefined}
            className="bg-primary text-on-primary shadow-raised hover:bg-primary-hover -mt-6 flex size-14 items-center justify-center rounded-full transition-colors"
          >
            <Plus aria-hidden="true" className="size-6" strokeWidth={2.4} />
          </Link>
        </li>
        {ITEMS.slice(2).map(link)}
      </ul>
    </nav>
  );
}

/** The same places as a column, for screens wide enough to spare the room. */
export function SideNav({ base, labels }: AppNavProps) {
  const active = useActive(base);
  return (
    <nav aria-label={labels.label} className="flex flex-col gap-1">
      <Link
        href={`${base}/add`}
        aria-current={active("/add") ? "page" : undefined}
        className="rounded-control bg-primary text-on-primary hover:bg-primary-hover mb-4 inline-flex h-12 items-center justify-center gap-2 px-4 font-semibold transition-colors"
      >
        <Plus aria-hidden="true" className="size-5" strokeWidth={2.4} />
        {labels.add}
      </Link>
      {ITEMS.map((item) => {
        const current = active(item.segment);
        return (
          <Link
            key={item.key}
            href={base + item.segment}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-control flex h-12 items-center gap-3 px-3.5 font-medium transition-colors",
              current ? "bg-accent text-on-accent font-semibold" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <item.icon aria-hidden="true" className="size-5" />
            {labels[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}
