"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { characters } from "@/lib/content/characters";
import { tr } from "@/lib/content/text";
import { useStudent } from "@/lib/client/student";
import {
  balance,
  campaignFinished,
  campaignOpen,
  chapterProgress,
  chapterStatus,
  currentCampaign,
  currentChapter,
  playedCampaign,
  runOf,
} from "@/lib/game/stats";
import { studentCampaigns } from "@/lib/game/world";
import { isGraded, type Campaign, type Chapter } from "@/lib/story/graph";
import type { ChapterState } from "@/lib/story/run";
import { fill } from "@/lib/i18n";
import { questHref, sceneLine } from "@/lib/student/story";
import { BottomNav } from "./bottom-nav";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/03_story_map/code.html.
// The path runs through every chapter of both campaigns, in order (the approved screen's five
// nodes: Prologue, Chapters II–IV and the Finale). Each node has its real state from the
// student's runs: done, current (the hero stands at it), open (the first chapter of a campaign
// not begun), or locked until the chapter before is finished; the first chapter of a campaign
// that is not open yet shows the campaign's gate ("Уровень B1 • Сложные загадки").
// The summary above the path is about the campaign being played.
// Owner's decisions 2026-10-24: Home's bottom bar, header named in the interface language.
// Tailwind v3 → v4: shadow-sm → shadow-xs.

type Stop = { campaign: Campaign; chapter: Chapter; status: ChapterState };

export function MapScreen() {
  const { t, locale, base, facts } = useStudent();
  const [view, setView] = useState<"map" | "list">("map");
  const campaign = playedCampaign(facts, currentCampaign(facts));
  const current = currentChapter(facts);
  const path: Stop[] = studentCampaigns(facts).flatMap((c) => {
    const played = playedCampaign(facts, c);
    return played.chapters.map((chapter) => ({ campaign: played, chapter, status: chapterStatus(facts, played, chapter) }));
  });
  const graded = campaign.chapters.flatMap((chapter) => chapter.scenes.filter(isGraded));
  const run = runOf(facts, campaign.id);
  const solved = graded.filter((scene) => run?.progress[scene.id]?.solved).length;
  // A story's branches skip some scenes: a finished campaign is complete whichever way it went.
  const percent = campaignFinished(facts, campaign.id) ? 100 : graded.length ? Math.round((solved / graded.length) * 100) : 0;
  const shown = current?.chapter ?? campaign.chapters.at(-1)!;
  const progress = chapterProgress(facts, campaign, shown);
  const hero = facts.profile.characterId ? characters[facts.profile.characterId] : null;

  return (
    <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased">
      <header className="pt-safe bg-surface/85 fixed top-0 z-50 w-full shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="px-margin mx-auto flex h-16 w-full max-w-[420px] items-center justify-between">
          <div className="gap-space-sm flex items-center">
            <div className="text-primary flex h-11 w-11 items-center justify-center rounded-full">
              <Icon name="auto_stories" className="text-[26px]" />
            </div>
            <h1 className="font-headline-md text-headline-md text-text-ivory truncate tracking-wide">{t.map.title}</h1>
          </div>
          <div className="gap-space-sm flex items-center">
            <Link
              href={`${base}/rewards`}
              aria-label={t.home.notifications}
              className="text-text-muted hover:text-primary flex h-11 w-11 items-center justify-center rounded-full transition-colors"
            >
              <Icon name="notifications" className="text-[22px]" />
            </Link>
            <Link
              href={`${base}/profile`}
              aria-label={t.common.profile}
              className="bg-primary flex h-8 w-8 items-center justify-center rounded-full"
            >
              <Icon name="person" className="text-on-primary text-[18px]" />
            </Link>
          </div>
        </div>
      </header>

      <main className="bg-background mx-auto w-full max-w-[420px] flex-1 pt-16 pb-20">
        <div className="text-on-surface flex w-full flex-col pb-12 select-none">
          <div className="px-margin gap-space-sm flex flex-col pt-2 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-caption text-caption text-primary flex items-center gap-1.5 tracking-wider uppercase">
                  <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"></span>
                  {fill(t.map.campaign, { name: tr(campaign.title, locale) })}
                </span>
                <h2 className="font-headline-lg text-headline-lg text-text-ivory mt-0.5 leading-tight">{t.map.heading}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`${base}/shop`}
                  className="bg-surface-container-high flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-md"
                  aria-label={t.shop.title}
                >
                  <span className="text-base leading-none">🪙</span>
                  <span className="font-label-md text-label-md text-primary font-semibold">{balance(facts, "coins")}</span>
                </Link>
              </div>
            </div>

            <div className="bg-surface-container relative flex items-center justify-between overflow-hidden rounded-xl p-3.5 shadow-lg">
              <div className="bg-secondary/10 pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full blur-xl"></div>
              <div className="flex items-center gap-3">
                <div className="bg-surface-container-highest text-primary flex h-10 w-10 items-center justify-center rounded-lg shadow-inner">
                  <Icon name="explore" className="text-[22px]" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-title-sm text-title-sm text-text-ivory">{fill(t.map.level, { cefr: shown.cefr })}</span>
                    {current ? (
                      <span className="bg-primary/20 text-primary font-caption text-caption rounded-full px-2 py-0.5 font-semibold uppercase">
                        {tr(current.chapter.label, locale)}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-caption text-caption text-text-muted">
                    {fill(t.map.solvedLine, { solved: progress.solved, total: progress.total, percent })}
                  </span>
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center">
                <div className="relative h-8 w-8" role="img" aria-label={`${percent}%`}>
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                    <path
                      className="text-surface-container-highest"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    ></path>
                    <path
                      className="text-primary"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray={`${percent}, 100`}
                      strokeLinecap="round"
                      strokeWidth="3"
                    ></path>
                  </svg>
                  <span className="font-caption text-text-ivory absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                    {percent}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-margin mb-6 flex justify-center">
            <div
              className="bg-surface-container-lowest flex w-full max-w-[280px] items-center gap-1 rounded-full p-1 shadow-md"
              role="tablist"
            >
              {(["map", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={view === mode}
                  onClick={() => setView(mode)}
                  className={
                    view === mode
                      ? "bg-surface text-primary font-label-sm text-label-sm flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 shadow-xs transition-all"
                      : "text-text-muted hover:text-text-ivory font-label-sm text-label-sm flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-all"
                  }
                >
                  <Icon name={mode === "map" ? "map" : "format_list_bulleted"} className="text-[16px]" />
                  <span>{mode === "map" ? t.map.interactive : t.map.list}</span>
                </button>
              ))}
            </div>
          </div>

          {/* The winding path is wider than a 320-px phone: it is clipped, the page never scrolls sideways. */}
          <div className="px-margin relative flex flex-col items-center overflow-x-clip">
            {view === "map" ? (
              <svg
                className="pointer-events-none absolute top-10 left-1/2 z-0 h-[920px] w-[340px] -translate-x-1/2"
                fill="none"
                viewBox="0 0 340 920"
                aria-hidden="true"
              >
                <path
                  d="M 170 40 Q 60 140 170 230 T 170 440 Q 280 540 170 650 T 170 850"
                  stroke="#8D75C9"
                  strokeLinecap="round"
                  strokeOpacity="0.18"
                  strokeWidth="8"
                ></path>
                <path
                  d="M 170 40 Q 60 140 170 230 T 170 440 Q 280 540 170 650 T 170 850"
                  stroke="#e4c285"
                  strokeDasharray="6 8"
                  strokeLinecap="round"
                  strokeOpacity="0.45"
                  strokeWidth="2.5"
                ></path>
                <circle cx="105" cy="130" fill="#e4c285" opacity="0.7" r="2.5"></circle>
                <circle cx="235" cy="335" fill="#d0bcff" opacity="0.8" r="3"></circle>
                <circle cx="110" cy="540" fill="#e4c285" opacity="0.5" r="2"></circle>
                <circle cx="230" cy="740" fill="#e4c285" opacity="0.4" r="2.5"></circle>
              </svg>
            ) : null}
            {path.map((stop, index) => {
              const last = index === path.length - 1;
              const here = current?.chapter.id === stop.chapter.id;
              if (here && view === "map") return <CurrentNode key={stop.chapter.id} stop={stop} heroImage={hero?.image ?? null} />;
              return (
                <ChapterNode
                  key={stop.chapter.id}
                  stop={stop}
                  previous={index > 0 ? path[index - 1].chapter : null}
                  boss={last}
                  compact={view === "list"}
                />
              );
            })}

            <div className="mt-4 flex w-full flex-col items-center overflow-hidden rounded-xl bg-[#D9C49B] p-4 text-center text-[#231D15] shadow-[0_8px_24px_rgba(0,0,0,0.7)]">
              <div className="text-primary-container mb-1 flex items-center gap-2">
                <span>✦</span>
                <span className="font-label-sm text-label-sm font-bold tracking-widest uppercase">{t.map.note}</span>
                <span>✦</span>
              </div>
              <p className="font-headline-md text-headline-md leading-tight italic">{tr(campaign.quote.text, locale)}</p>
              <span className="font-caption text-caption mt-2 opacity-75">{tr(campaign.quote.source, locale)}</span>
            </div>
          </div>
        </div>
      </main>
      <BottomNav base={base} active="story" labels={t.nav} position="screen" />
    </div>
  );
}

function CurrentNode({ stop, heroImage }: { stop: Stop; heroImage: string | null }) {
  const { t, locale, base, facts } = useStudent();
  const { campaign, chapter, status } = stop;
  const { solved, total } = chapterProgress(facts, campaign, chapter);
  const position = Math.min(solved + 1, total);
  const run = runOf(facts, campaign.id);
  const scene = chapter.scenes.find((s) => s.id === run?.scene) ?? chapter.scenes[0];
  const nextGraded = chapter.scenes.filter(isGraded).find((s) => !run?.progress[s.id]?.solved);
  return (
    <div className="relative z-20 mb-16 flex w-full flex-col items-center" data-chapter={chapter.id} data-status={status}>
      <div className="relative z-30 -mb-3 flex flex-col items-center motion-safe:animate-bounce" style={{ animationDuration: "2.4s" }}>
        <div className="bg-surface-container-highest mb-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-xl">
          <span className="text-xs">🐾</span>
          <span className="font-label-sm text-label-sm text-text-ivory">{fill(t.map.here, { n: position, total })}</span>
        </div>
        {heroImage ? (
          <div className="bg-surface-container-highest h-16 w-16 overflow-hidden rounded-full shadow-[0_0_20px_rgba(208,188,255,0.45)]">
            <img alt="" className="h-full w-full origin-[50%_25%] scale-125 object-cover" src={heroImage} />
          </div>
        ) : null}
      </div>
      <div className="group bg-surface-container-high relative flex h-24 w-24 items-center justify-center rounded-full shadow-[0_0_30px_rgba(141,117,201,0.4)]">
        <div className="bg-secondary/20 absolute inset-0 rounded-full motion-safe:animate-ping" style={{ animationDuration: "3s" }}></div>
        <div className="from-primary via-primary-container to-on-primary-container flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b shadow-[0_0_20px_rgba(228,194,133,0.5)]">
          <Icon name={chapter.icon} className="text-surface-container-lowest text-[38px]" />
        </div>
        <div className="bg-secondary text-on-secondary-fixed font-caption absolute -top-1 -right-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase shadow-md">
          {t.map.current}
        </div>
      </div>
      <div className="bg-surface relative mt-4 flex w-full max-w-[320px] flex-col gap-3 overflow-hidden rounded-xl p-4 shadow-2xl backdrop-blur-xl">
        <div className="via-primary absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent to-transparent opacity-80"></div>
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption text-secondary flex items-center gap-1 font-semibold tracking-widest uppercase">
              <span>✦</span> {tr(chapter.label, locale)} • {chapter.cefr}
            </span>
            <h3 className="font-headline-md text-headline-md text-text-ivory mt-0.5 leading-tight">{tr(chapter.title, locale)}</h3>
          </div>
          <span className="bg-surface-container-highest text-primary font-label-sm text-label-sm shrink-0 rounded-md px-2.5 py-1 font-semibold">
            +{nextGraded?.xp ?? chapter.reward.xp} XP
          </span>
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="text-caption font-caption text-text-muted flex items-center justify-between">
            <span>{tr(chapter.subtitle, locale)}</span>
            <span className="text-text-ivory font-medium">{fill(t.map.of, { n: solved, total })}</span>
          </div>
          <div className="bg-surface-container-lowest flex h-2 w-full gap-1 overflow-hidden rounded-full p-0.5">
            {chapter.scenes.filter(isGraded).map((n, i) => (
              <div key={n.id} className={`h-full flex-1 rounded-full ${i < solved ? "bg-primary" : "bg-surface-container-high"}`}></div>
            ))}
          </div>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 leading-snug italic">«{sceneLine(scene)}»</p>
        <Link
          href={questHref(base, campaign, chapter)}
          className="font-label-md text-label-md mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] font-bold tracking-wider text-[#101016] uppercase shadow-[0_0_18px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98]"
        >
          <span>{status === "open" ? t.map.start : t.map.continue}</span>
          <Icon name="arrow_forward" className="text-[20px]" />
        </Link>
      </div>
    </div>
  );
}

function ChapterNode({ stop, previous, boss, compact }: { stop: Stop; previous: Chapter | null; boss: boolean; compact: boolean }) {
  const { t, locale, base, facts } = useStudent();
  const { campaign, chapter, status } = stop;
  // The gate of a campaign not open yet is shown on its first chapter; a chapter may have a banner of its own.
  const gate = (!campaignOpen(facts, campaign) && campaign.chapters[0] === chapter ? campaign.gate : undefined) ?? chapter.gate;

  if (status === "done" || ((status === "current" || status === "open") && compact)) {
    return (
      <div
        className={`relative z-10 flex w-full flex-col items-center ${compact ? "mb-6" : "mb-14"}`}
        data-chapter={chapter.id}
        data-status={status}
      >
        {status === "done" ? (
          <div className="bg-surface-container-high mb-2 flex items-center gap-2 rounded-full px-3 py-1 shadow-xs">
            <Icon name="verified" className="text-status-success text-[15px]" />
            <span className="font-caption text-caption text-status-success font-medium">{fill(t.map.done, { xp: chapter.reward.xp })}</span>
          </div>
        ) : null}
        <Link
          href={questHref(base, campaign, chapter)}
          aria-label={tr(chapter.title, locale)}
          className="group bg-surface-container relative flex h-20 w-20 items-center justify-center rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-transform active:scale-95"
        >
          <div className="from-primary-container to-primary flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b shadow-[0_0_15px_rgba(228,194,133,0.3)]">
            <Icon name={chapter.icon} className="text-on-primary text-[32px]" />
          </div>
          {status === "done" ? (
            <div className="bg-status-success text-surface-container-lowest absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full shadow-md">
              <Icon name="check" className="text-[18px] font-bold" />
            </div>
          ) : null}
        </Link>
        <div className="bg-surface/90 mt-3 flex max-w-[260px] flex-col items-center rounded-xl p-3 text-center shadow-md backdrop-blur-md">
          <span className="font-label-sm text-primary text-[11px] font-semibold tracking-wider uppercase">{tr(chapter.label, locale)}</span>
          <h3 className="font-title-sm text-title-sm text-text-ivory">{tr(chapter.title, locale)}</h3>
          <p className="font-caption text-caption text-text-muted mt-0.5">{tr(chapter.subtitle, locale)}</p>
        </div>
      </div>
    );
  }

  // Locked: behind the chapter before it, or behind the campaign's gate.
  const banner = gate
    ? {
        icon: boss ? ("military_tech" as const) : ("auto_awesome" as const),
        tone: boss ? "text-primary font-semibold" : "text-secondary",
        text: tr(gate, locale),
      }
    : {
        icon: "lock" as const,
        tone: "text-text-muted",
        text: fill(t.map.requires, { chapter: previous ? tr(previous.labelAccusative, locale) : "" }),
      };
  const fade = boss ? "opacity-65" : gate ? "opacity-75" : "opacity-85";

  return (
    <div
      className={`relative z-10 flex w-full flex-col items-center ${compact ? "mb-6" : boss ? "mb-6" : "mb-14"} ${fade}`}
      data-chapter={chapter.id}
      data-status={status}
    >
      <div className="bg-surface-container-lowest mb-2 flex items-center gap-1.5 rounded-full px-3 py-1 shadow-xs">
        <Icon name={banner.icon} className={`text-[14px] ${banner.tone}`} />
        <span className={`font-caption text-caption ${banner.tone}`}>{banner.text}</span>
      </div>
      {boss ? (
        <div className="bg-surface-container-lowest relative flex h-20 w-20 items-center justify-center rounded-full shadow-xl">
          <div className="bg-surface-container-high text-primary-container flex h-16 w-16 items-center justify-center rounded-full shadow-inner">
            <Icon name="shield_moon" className="text-[32px]" />
          </div>
          <div className="bg-surface-container-highest text-primary absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full shadow-md">
            <Icon name="key" className="text-[16px]" />
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-low relative flex h-[72px] w-[72px] items-center justify-center rounded-full shadow-lg">
          <div className="bg-surface-container text-text-muted flex h-16 w-16 items-center justify-center rounded-full shadow-inner">
            <Icon name={chapter.icon} className="text-[28px]" />
          </div>
          <div className="bg-surface-container-highest text-text-muted absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full shadow-md">
            <Icon name="lock" className="text-[15px]" />
          </div>
        </div>
      )}
      <div
        className={`mt-3 flex flex-col items-center rounded-xl p-3 text-center shadow-xs ${boss ? "bg-surface/50 max-w-[250px]" : "bg-surface/70 max-w-[240px]"}`}
      >
        <span
          className={`font-label-sm text-[11px] uppercase ${boss ? "text-primary font-bold tracking-widest" : "text-text-muted tracking-wider"}`}
        >
          {tr(chapter.label, locale)}
        </span>
        <h4 className={`font-title-sm text-title-sm ${boss ? "text-on-surface" : "text-on-surface-variant"}`}>
          {tr(chapter.title, locale)}
        </h4>
        <span className="font-caption text-caption text-text-muted mt-0.5">{tr(chapter.subtitle, locale)}</span>
      </div>
    </div>
  );
}
