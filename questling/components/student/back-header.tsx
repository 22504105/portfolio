import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n";

// The header of the story-player screens (05_story_player_2): back arrow, the screen's
// title, the profile button. Screens opened from somewhere else (settings) use it too.
export function BackHeader({ title, backHref, profileHref, t }: { title: string; backHref: string; profileHref: string; t: Dictionary }) {
  return (
    <header className="bg-surface/85 pt-safe fixed top-(--demo-bar) z-50 w-full shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      <div className="px-margin mx-auto flex h-16 w-full max-w-[420px] items-center justify-between">
        <div className="gap-space-xs flex items-center">
          <Link
            href={backHref}
            aria-label={t.common.back}
            className="text-primary hover:text-text-ivory flex h-11 w-11 items-center justify-center rounded-full transition-colors"
          >
            <Icon name="arrow_back_ios_new" className="text-[24px]" />
          </Link>
          <h1 className="font-headline-md text-headline-md text-text-ivory max-w-[210px] truncate tracking-wide">{title}</h1>
        </div>
        <div className="gap-space-sm flex items-center">
          <Link
            href={profileHref}
            aria-label={t.common.profile}
            className="bg-primary flex h-8 w-8 items-center justify-center rounded-full"
          >
            <Icon name="person" className="text-on-primary text-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}
