"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { findChapter } from "@/lib/content/campaigns";
import { tr } from "@/lib/content/text";
import { speak, useSpeechSupported } from "@/lib/client/sound";
import { useStudent } from "@/lib/client/student";
import { chapterProgress, chapterStatus, playedCampaign, runOf } from "@/lib/game/stats";
import { isGraded } from "@/lib/story/graph";
import { fill } from "@/lib/i18n";
import { sceneLine } from "@/lib/student/story";
import { BackHeader } from "./back-header";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/04_quest_details/code.html.
// The speaker reads the current diary entry aloud (the export toggled an ambient track that
// does not exist). The progress card opens the evidence journal. Gate 3: the chapter is part of a
// campaign's story graph; its progress is its graded scenes solved in the student's run, and the
// diary quotes the scene the run is at (or the last one solved).
// Tailwind v3 → v4: drop-shadow-sm → drop-shadow-xs.

export function QuestDetailsScreen({ chapterId }: { chapterId: string }) {
  const { t, locale, base, facts } = useStudent();
  const speech = useSpeechSupported();
  const found = findChapter(chapterId)!;
  const campaign = playedCampaign(facts, found.campaign);
  const chapter = campaign.chapters.find((c) => c.id === chapterId) ?? found.chapter;
  const run = runOf(facts, campaign.id);
  const status = chapterStatus(facts, campaign, chapter);
  const { solved, total } = chapterProgress(facts, campaign, chapter);
  const graded = chapter.scenes.filter(isGraded);
  // The newest clue of this chapter the student holds.
  const chapterClues = new Set(chapter.scenes.flatMap((scene) => ("clue" in scene && scene.clue ? [scene.clue] : [])));
  const lastClueId = [...(run?.clues ?? [])].reverse().find((id) => chapterClues.has(id));
  const lastClue = lastClueId ? campaign.clues.find((c) => c.id === lastClueId) : null;
  const atScene = status === "current" && run ? chapter.scenes.find((scene) => scene.id === run.scene) : null;
  const lastSolved = [...graded].reverse().find((scene) => run?.progress[scene.id]?.solved);
  const entry = atScene ?? lastSolved ?? graded[0] ?? chapter.scenes[0];
  const entryIndex = status === "done" ? total : Math.min(solved + 1, total);
  const percent = status === "done" ? 100 : total ? Math.round((solved / total) * 100) : 0;
  const playable = status === "current" || status === "open";

  return (
    <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased">
      <BackHeader title={t.details.title} backHref={`${base}/map`} profileHref={`${base}/profile`} t={t} />
      <main className="pb-safe bg-background mx-auto w-full max-w-[420px] flex-1 pt-16">
        <div className="flex w-full flex-col pb-32">
          <div className="px-margin pt-space-sm relative w-full">
            <div className="bg-surface-container-low relative h-64 w-full overflow-hidden rounded-xl shadow-2xl">
              <img
                alt={tr(chapter.title, locale)}
                className="h-full w-full scale-105 transform object-cover transition-transform duration-700"
                src={chapter.image}
              />
              <div className="from-surface via-surface/40 absolute inset-0 bg-gradient-to-t to-transparent"></div>
              <div className="from-surface/60 absolute inset-0 bg-gradient-to-r via-transparent to-transparent"></div>
              <div className="top-space-md left-space-md right-space-md pointer-events-none absolute flex items-center justify-between">
                <div className="gap-space-xs bg-surface-container-lowest/80 flex items-center rounded-full px-2.5 py-1 shadow-md backdrop-blur-md">
                  <span className="text-primary font-headline-md text-caption tracking-wider uppercase">✦ {tr(chapter.label, locale)}</span>
                  <span className="text-outline text-caption">•</span>
                  <span className="text-secondary font-label-sm font-semibold tracking-wide">CEFR {chapter.cefr}</span>
                </div>
                <div className="bg-surface-container-lowest/80 text-text-ivory flex items-center gap-1 rounded-full px-2.5 py-1 shadow-md backdrop-blur-md">
                  <Icon name="schedule" className="text-primary text-[15px]" />
                  <span className="font-label-sm">{fill(t.details.minutes, { n: chapter.minutes })}</span>
                </div>
              </div>
              {entry ? (
                <div className="bottom-space-md right-space-md absolute">
                  <button
                    type="button"
                    aria-label={t.details.listen}
                    disabled={!speech}
                    onClick={() => speak(sceneLine(entry))}
                    className="bg-surface-container-high/90 text-primary flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-md transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Icon name="volume_up" className="text-[20px]" />
                  </button>
                </div>
              ) : null}
              <div className="bg-secondary-container/20 pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full blur-2xl"></div>
            </div>
          </div>

          <div className="px-margin mt-space-lg flex flex-col">
            <div className="gap-space-xs text-primary font-label-sm mb-1 flex items-center tracking-widest uppercase">
              <Icon name="auto_stories" className="text-[16px]" />
              <span>{t.details.branch}</span>
            </div>
            <h2 className="font-headline-xl-mobile text-headline-xl-mobile text-text-ivory leading-tight drop-shadow-xs">
              {tr(chapter.title, locale)}
            </h2>
            <p className="mt-space-sm font-body-md text-body-md text-text-muted leading-relaxed">{tr(chapter.description, locale)}</p>
          </div>

          <div className="px-margin mt-space-lg">
            <Link
              href={`${base}/journal/${campaign.id}`}
              className="bg-surface relative block overflow-hidden rounded-xl p-4 shadow-xl"
              aria-label={t.journal.title}
            >
              <div className="bg-secondary/10 pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-xl"></div>
              <div className="mb-space-xs flex items-center justify-between">
                <div className="text-text-ivory font-label-md flex items-center gap-1.5">
                  <Icon name="travel_explore" className="text-primary text-[18px]" />
                  <span>{t.details.progress}</span>
                </div>
                <span className="font-label-sm text-primary font-medium tracking-wide">{fill(t.details.clues, { n: solved, total })}</span>
              </div>
              <div className="bg-surface-container-lowest mt-2 flex h-2.5 w-full gap-1 rounded-full p-0.5">
                {graded.map((n, i) => (
                  <div
                    key={n.id}
                    className={`h-full flex-1 rounded-full ${i < solved ? "bg-primary shadow-[0_0_8px_rgba(228,194,133,0.6)]" : "bg-surface-container-highest/60"}`}
                  ></div>
                ))}
              </div>
              <div className="text-caption font-caption text-text-muted mt-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${lastClue ? "bg-status-success" : "bg-surface-container-highest"}`}
                  ></span>
                  {lastClue ? fill(t.details.found, { clue: tr(lastClue.title, locale) }) : t.details.notStarted}
                </span>
                <span className="text-secondary font-medium">{fill(t.details.percent, { n: percent })}</span>
              </div>
            </Link>
          </div>

          <div className="px-margin mt-space-lg gap-space-md flex flex-col">
            <div className="bg-surface-container-low relative rounded-xl p-4 shadow-lg">
              <div className="mb-3 flex items-center gap-2">
                <div className="bg-surface-container-high text-primary flex h-7 w-7 items-center justify-center rounded-lg">
                  <Icon name="school" className="text-[18px]" />
                </div>
                <h3 className="font-title-sm text-title-sm text-text-ivory">{t.details.goals}</h3>
              </div>
              <div className="text-body-md font-body-md text-on-surface-variant space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="text-primary mt-0.5 text-[14px]">✦</span>
                  <span>
                    <strong className="text-text-ivory font-medium">{t.details.skills}</strong> {tr(chapter.skills, locale)}
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-primary mt-0.5 text-[14px]">✦</span>
                  <span>
                    <strong className="text-text-ivory font-medium">{t.details.mission}</strong> {tr(chapter.mission, locale)}
                  </span>
                </div>
              </div>
              <div className="bg-surface-container/60 -mx-4 mt-4 -mb-4 rounded-b-xl border-t-0 p-4 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-caption font-label-sm text-text-muted tracking-wider uppercase">{t.details.words}</span>
                  <span className="text-caption text-secondary">{fill(t.details.wordCount, { n: chapter.words.length })}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {chapter.words.map((word) => (
                    <button
                      key={word}
                      type="button"
                      disabled={!speech}
                      onClick={() => speak(word)}
                      className="bg-surface-container-high text-text-ivory font-label-sm active:bg-secondary-container flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors"
                    >
                      <span>{word}</span>
                      <Icon name="volume_down" className="text-primary text-[13px]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {entry ? (
              <div className="bg-tertiary-fixed-dim/95 text-surface-container-lowest relative overflow-hidden rounded-xl p-4 shadow-xl">
                <div className="text-on-tertiary font-georgia text-center text-[13px] tracking-widest opacity-75">
                  ✦ {t.details.diary} ✦
                </div>
                <p className="font-headline-md text-surface-container-lowest mt-2 text-center text-[19px] leading-snug italic">
                  “{sceneLine(entry)}”
                </p>
                <div className="text-caption font-label-sm text-on-tertiary-container mt-2 text-center">
                  {fill(t.details.hintFor, { n: entryIndex, place: tr(entry.location, locale) })}
                </div>
              </div>
            ) : null}

            <div className="bg-surface flex items-center justify-between rounded-xl p-4 shadow-md">
              <div className="flex items-center gap-3">
                <div className="bg-primary-container/20 text-primary flex h-10 w-10 items-center justify-center rounded-full shadow-[0_0_12px_rgba(228,194,133,0.3)]">
                  <Icon name="military_tech" className="text-[24px]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-text-ivory font-title-sm text-[16px]">{t.details.rewards}</span>
                  <span className="text-caption text-text-muted font-caption">{t.details.firstTime}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-surface-container-high flex items-center gap-1 rounded-lg px-2.5 py-1">
                  <span className="text-primary font-label-md font-semibold">+{chapter.reward.xp}</span>
                  <span className="font-label-sm text-secondary text-[11px]">XP</span>
                </div>
                <div className="bg-surface-container-high flex items-center gap-1 rounded-lg px-2.5 py-1">
                  <span className="text-[14px]">🪙</span>
                  <span className="text-text-ivory font-label-md font-semibold">{chapter.reward.coins}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface/90 fixed right-0 bottom-0 left-0 z-40 shadow-[0_-8px_24px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="px-margin pt-space-sm pb-safe mx-auto flex max-w-[420px] flex-col items-center">
              <Link
                href={playable ? `${base}/play/${campaign.id}` : `${base}/journal/${campaign.id}`}
                className="from-primary-fixed to-primary-container text-surface-container-lowest font-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b font-bold tracking-wider uppercase shadow-[0_4px_16px_rgba(228,194,133,0.3)] transition-transform active:scale-[0.98]"
              >
                <span>{playable ? t.details.continue : t.details.openJournal}</span>
                <Icon name="arrow_forward" className="text-[20px]" />
              </Link>
              <div className="text-caption font-caption text-text-muted flex items-center gap-1.5 py-2">
                <Icon name="verified" className="text-primary text-[13px]" />
                <span>{t.details.free}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
