import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

// The one bottom bar of the student app: Home's own bar from 02_home_2 (owner's decision
// 2026-10-24, docs/design-screen-map.md, conflict 6), on every main screen. Screens where
// the student is in the middle of something (the story player, puzzles) have none.

const tabs = [
  {
    id: "home",
    path: "/home",
    width: "1.8",
    d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    id: "story",
    path: "/map",
    width: "1.6",
    d: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    id: "quests",
    path: "/quests",
    width: "1.6",
    d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    id: "profile",
    path: "/profile",
    width: "1.6",
    d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
] as const;

export type Tab = (typeof tabs)[number]["id"];

type Props = {
  base: string;
  active: Tab;
  labels: Dictionary["nav"];
  /** "frame": pinned to the bottom of Home's phone frame; "screen": pinned to the window. */
  position?: "frame" | "screen";
};

export function BottomNav({ base, active, labels, position = "frame" }: Props) {
  const placement = position === "frame" ? "absolute inset-x-0" : "fixed inset-x-0 mx-auto max-w-[390px]";
  return (
    <nav
      className={`${placement} bottom-0 z-30 flex items-center justify-around border-t border-[#3A3228] bg-[#14131D]/95 px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md`}
    >
      {tabs.map((tab) =>
        tab.id === active ? (
          <Link
            key={tab.id}
            href={`${base}${tab.path}`}
            aria-label={labels[tab.id]}
            aria-current="page"
            className="group relative flex w-16 flex-col items-center pt-1"
          >
            <span className="absolute top-0 h-[2px] w-8 bg-gradient-to-r from-transparent via-[#CFAC6E] to-transparent"></span>
            <svg className="mb-1 h-5 w-5 text-[#CFAC6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d={tab.d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab.width}></path>
            </svg>
            <span className="text-[10px] font-medium tracking-tight text-[#CFAC6E]">{labels[tab.id]}</span>
          </Link>
        ) : (
          <Link
            key={tab.id}
            href={`${base}${tab.path}`}
            aria-label={labels[tab.id]}
            className="group text-parchmentMuted hover:text-parchment flex w-16 flex-col items-center pt-1 transition-colors"
          >
            <svg className="mb-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d={tab.d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab.width}></path>
            </svg>
            <span className="text-[10px] font-normal tracking-tight">{labels[tab.id]}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
