import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n";

// The header of the profile, quick quests and rewards screens (11, 08, 10): book emblem,
// the screen's name, the coin balance (opens the shop) and the profile button.
export function CoinHeader({
  title,
  coins,
  base,
  t,
  bordered = false,
}: {
  title: string;
  coins: number;
  base: string;
  t: Dictionary;
  bordered?: boolean;
}) {
  return (
    <header
      className={`pt-safe fixed inset-x-0 top-(--demo-bar) z-50 backdrop-blur-xl ${
        bordered
          ? "border-b border-[#6E5A3A]/20 bg-[#1C1B27]/90 shadow-[0_1px_8px_rgba(0,0,0,0.5)]"
          : "bg-surface/90 shadow-[0_1px_8px_rgba(0,0,0,0.4)]"
      }`}
    >
      <div className="px-gutter mx-auto flex h-16 w-full max-w-md items-center justify-between">
        <div className="gap-space-sm flex items-center">
          <div className="bg-surface-container-high text-primary flex h-9 w-9 items-center justify-center rounded-full">
            <Icon name="auto_stories" className="text-[20px]" />
          </div>
          <h1 className="font-headline-md text-headline-md text-text-ivory tracking-tight">{title}</h1>
        </div>
        <div className="gap-space-md flex items-center">
          <Link
            href={`${base}/shop`}
            aria-label={t.shop.title}
            className={`gap-space-xs bg-surface-container-high px-space-md flex items-center rounded-full py-1 shadow-[0_0_12px_rgba(185,154,97,0.15)] ${bordered ? "border border-[#6E5A3A]/30" : ""}`}
          >
            <Icon name="monetization_on" className="text-primary text-[18px]" />
            <span className="font-label-md text-label-md text-primary font-bold" data-coins>
              {coins}
            </span>
          </Link>
          <Link
            href={`${base}/profile`}
            aria-label={t.common.profile}
            className="bg-primary flex h-8 w-8 items-center justify-center rounded-full shadow-[0_0_8px_rgba(228,194,133,0.3)]"
          >
            <Icon name="person" className="text-on-primary text-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}
