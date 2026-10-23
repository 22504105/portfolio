/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { pluralDays, xpPercent, type HomeView } from "@/lib/student/home";
import { PronounceButton } from "./pronounce-button";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/02_home_2/code.html.
// Class names follow the export; Tailwind v3 → v4 renames are applied
// (backdrop-blur-sm → backdrop-blur-xs, shadow-sm → shadow-xs, drop-shadow-sm → drop-shadow-xs).

const chevron = <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>;

export function HomeScreen({ view, base }: { view: HomeView; base: string }) {
  const { hero, featured, dailyQuests, word } = view;
  return (
    <div data-scope="home" className="flex min-h-dvh justify-center bg-[#0b0b0f] font-sans text-[#E8E1D5] select-none">
      <div className="relative flex h-dvh w-full max-w-[390px] flex-col overflow-hidden border border-stone-800/60 bg-[#101016] shadow-2xl">
        <header className="z-20 flex items-center justify-between px-4 pt-10 pb-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-[#CFAC6E]">✦</span>
            <h1 className="font-cinzel text-xs font-bold tracking-[0.25em] text-[#CFAC6E] drop-shadow-xs">QUESTLING</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              aria-label="Уведомления"
              className="text-parchment/80 relative flex h-9 w-9 items-center justify-center rounded-full border border-[#3A3228] bg-[#1C1B27] transition-transform active:scale-95"
            >
              <svg className="h-4 w-4 text-[#CFAC6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                ></path>
              </svg>
              {view.unreadNotifications ? (
                <span className="bg-magicViolet absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full shadow-[0_0_6px_#8D75C9]"></span>
              ) : null}
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-4 overflow-y-auto px-4 pt-1 pb-24">
          <section className="relative overflow-hidden rounded-2xl border border-[#524432]/70 bg-[#1C1B27] p-3.5 shadow-lg">
            <div className="bg-magicViolet/20 pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full blur-2xl"></div>
            <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-[#B99A61]/10 blur-xl"></div>
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="relative flex h-36 w-32 flex-shrink-0 items-end justify-center">
                <div className="absolute bottom-1 h-4 w-24 rounded-full bg-black/40 blur-[3px]"></div>
                <img
                  alt={hero.name}
                  className="relative z-10 h-36 w-32 object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.65)] transition-transform duration-300 hover:scale-105"
                  src={hero.image}
                />
                <span className="font-cinzel absolute bottom-0 left-2 z-20 flex items-center gap-1 rounded-full border border-[#8B6F3E] bg-[#14131D] px-2 py-0.5 text-[10px] font-bold text-[#CFAC6E] shadow-md">
                  <span>Ур.</span> {hero.level}
                </span>
              </div>
              <div className="flex h-36 min-w-0 flex-1 flex-col justify-between py-0.5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-cinzel text-[10px] font-bold tracking-wider text-[#CFAC6E] uppercase">{hero.rank}</span>
                    <span className="font-cinzel text-[10px] text-[#CFAC6E]">✦</span>
                  </div>
                  <h3 className="font-cormorant text-parchment mt-0.5 truncate text-lg leading-tight font-bold">{hero.name}</h3>
                </div>
                <div className="my-1 grid grid-cols-2 gap-1.5">
                  <div className="flex items-center space-x-1.5 rounded-lg border border-[#3A3228] bg-[#14131D]/90 px-2 py-1 shadow-xs">
                    <span className="text-xs text-orange-400">🔥</span>
                    <div className="flex flex-col">
                      <span className="text-parchmentMuted text-[9px] leading-none font-medium">Серия</span>
                      <span className="text-xs leading-tight font-semibold text-[#F0EBE1]">{pluralDays(hero.streakDays)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 rounded-lg border border-[#3A3228] bg-[#14131D]/90 px-2 py-1 shadow-xs">
                    <span className="text-xs text-[#CFAC6E]">🪙</span>
                    <div className="flex flex-col">
                      <span className="text-parchmentMuted text-[9px] leading-none font-medium">Золото</span>
                      <span className="text-xs leading-tight font-semibold text-[#CFAC6E]">{hero.coins}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-parchmentMuted font-medium">Опыт</span>
                    <span className="font-mono tracking-tight text-[#CFAC6E]">
                      {hero.xp.current} / {hero.xp.next} XP
                    </span>
                  </div>
                  <div
                    className="border-magicViolet/30 h-1.5 w-full overflow-hidden rounded-full border bg-[#252233] p-[1px]"
                    role="progressbar"
                    aria-label="Опыт"
                    aria-valuemin={0}
                    aria-valuemax={hero.xp.next}
                    aria-valuenow={hero.xp.current}
                  >
                    <div
                      className="from-magicViolet shadow-violet-glow h-full rounded-full bg-gradient-to-r to-[#B799FF]"
                      style={{ width: `${xpPercent(hero.xp.current, hero.xp.next)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="group relative overflow-hidden rounded-2xl border border-[#524432] bg-[#1C1B27] shadow-xl">
            <div className="relative h-52 w-full overflow-hidden">
              <div className="absolute inset-0 bg-[#12111A]">
                <img
                  alt={featured.title}
                  className="h-full w-full transform object-cover object-[15%_25%] brightness-95 contrast-105 filter transition-transform duration-700 group-hover:scale-105"
                  src={featured.image}
                />
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(141,117,201,0.35)_0%,transparent_60%),linear-gradient(to_top,#1C1B27_5%,rgba(28,27,39,0.2)_60%,transparent_100%)]"></div>
              <div className="absolute top-3 left-3 z-10 flex items-center space-x-1.5 rounded-md border border-[#6E5A3A]/70 bg-[#14131DE6] px-2.5 py-1 shadow-md backdrop-blur-xs">
                <span className="font-cinzel text-[10px] font-bold tracking-wider text-[#CFAC6E] uppercase">{featured.chapter}</span>
                <span className="text-[8px] text-[#6E5A3A]">•</span>
                <span className="font-cinzel text-magicViolet text-[10px] font-semibold tracking-wider">{featured.cefr}</span>
              </div>
              <div className="absolute right-3 bottom-3 left-3 z-10">
                <h3 className="font-cormorant text-parchment mb-3 text-[22px] leading-tight font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {featured.title}
                </h3>
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={featured.continueHref}
                    className="flex flex-1 items-center justify-center space-x-2 rounded-xl border border-[#F3DE9C]/30 bg-[linear-gradient(135deg,#CFAC6E_0%,#B99A61_50%,#8C6F3A_100%)] px-4 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition-all hover:brightness-110 active:brightness-95"
                  >
                    <span className="text-[9px] text-[#33220A]">✦</span>
                    <span className="font-cormorant text-base font-bold tracking-wide text-[#251A08]">Продолжить</span>
                    <svg className="h-4 w-4 stroke-[2.5] text-[#251A08]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </Link>
                  <Link
                    href={featured.mapHref}
                    aria-label="Карта мира"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#6E5A3A]/80 bg-[#171622]/90 text-[#CFAC6E] shadow-md transition-colors hover:border-[#CFAC6E]"
                  >
                    <svg className="h-5 w-5 text-[#CFAC6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" strokeDasharray="1 1" strokeWidth="1.5"></circle>
                      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" strokeWidth="1.5"></path>
                      <polygon fill="#B99A61" points="12 8 14 12 12 16 10 12" stroke="none"></polygon>
                      <circle cx="12" cy="12" fill="#1C1B27" r="1.5"></circle>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-cormorant text-parchment flex items-center space-x-2 text-lg font-semibold tracking-wide">
                <span>Ежедневные квесты</span>
              </h3>
              <Link
                href={`${base}/quests`}
                aria-label="Все квесты"
                className="text-parchmentMuted flex items-center space-x-1 text-xs transition-colors hover:text-[#CFAC6E]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {chevron}
                </svg>
              </Link>
            </div>
            <div className="space-y-2">
              {dailyQuests.map((quest) => (
                <Link
                  key={quest.id}
                  href={quest.href}
                  className="flex items-center justify-between rounded-xl border border-[#3A3228] bg-[#1C1B27] p-3 shadow-md transition-colors active:bg-[#222130]"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={
                        quest.tone === "violet"
                          ? "border-magicViolet/40 relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[#14131D] shadow-inner"
                          : "relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#483B28] bg-[#14131D]"
                      }
                    >
                      <img alt={quest.title} className="h-full w-full object-cover" src={quest.image} />
                    </div>
                    <div>
                      <h4 className="font-sans text-sm leading-snug font-semibold text-[#F0EBE1]">{quest.title}</h4>
                      <p className="text-parchmentMuted mt-0.5 text-xs font-normal">{quest.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 pl-2 text-xs font-medium text-[#CFAC6E]">
                    <span className="font-semibold">+{quest.xp} XP</span>
                    <svg className="h-3.5 w-3.5 text-[#CFAC6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {chevron}
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-2 pt-1 pb-2">
            <h3 className="font-cormorant text-parchment px-1 text-lg font-semibold tracking-wide">Слово дня</h3>
            <article className="relative overflow-hidden rounded-xl border border-[#524432] bg-[#1C1B27] p-3.5 shadow-lg">
              <span className="absolute top-2.5 right-2.5 text-xs text-[#CFAC6E]/70">✧</span>
              <div className="flex items-center space-x-3.5">
                <div className="border-magicViolet/50 relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[#14131D]">
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-950/60 to-black/80">
                    <span className="text-magicViolet animate-pulse text-2xl">🔮</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <Link href={word.href} className="font-cormorant text-parchment text-xl font-bold tracking-wide">
                      {word.word}
                    </Link>
                    <PronounceButton word={word.word} />
                  </div>
                  <p className="text-parchmentMuted -mt-0.5 text-xs font-medium">{word.translation}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center rounded-lg border border-[#2F2922] bg-[#13121D] px-3 py-1.5">
                <span className="text-parchment/90 font-sans text-xs tracking-wide italic">&quot;{word.example}&quot;</span>
              </div>
            </article>
          </section>
        </main>

        <BottomNav base={base} active="home" />
      </div>
    </div>
  );
}

const tabs = [
  {
    id: "home",
    label: "Главная",
    path: "/home",
    width: "1.8",
    d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    id: "story",
    label: "Сюжет",
    path: "/map",
    width: "1.6",
    d: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    id: "quests",
    label: "Квесты",
    path: "/quests",
    width: "1.6",
    d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    id: "profile",
    label: "Профиль",
    path: "/profile",
    width: "1.6",
    d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
] as const;

// Home's own bottom bar (other screens draw theirs differently; see docs/design-screen-map.md, conflict 6).
function BottomNav({ base, active }: { base: string; active: (typeof tabs)[number]["id"] }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[#3A3228] bg-[#14131D]/95 px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md">
      {tabs.map((tab) =>
        tab.id === active ? (
          <Link
            key={tab.id}
            href={`${base}${tab.path}`}
            aria-label={tab.label}
            aria-current="page"
            className="group relative flex w-16 flex-col items-center pt-1"
          >
            <span className="absolute top-0 h-[2px] w-8 bg-gradient-to-r from-transparent via-[#CFAC6E] to-transparent"></span>
            <svg className="mb-1 h-5 w-5 text-[#CFAC6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d={tab.d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab.width}></path>
            </svg>
            <span className="text-[10px] font-medium tracking-tight text-[#CFAC6E]">{tab.label}</span>
          </Link>
        ) : (
          <Link
            key={tab.id}
            href={`${base}${tab.path}`}
            aria-label={tab.label}
            className="group text-parchmentMuted hover:text-parchment flex w-16 flex-col items-center pt-1 transition-colors"
          >
            <svg className="mb-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d={tab.d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab.width}></path>
            </svg>
            <span className="text-[10px] font-normal tracking-tight">{tab.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
