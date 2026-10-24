"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { tr } from "@/lib/content/text";
import { useStudent } from "@/lib/client/student";
import type { Facts } from "@/lib/game/facts";
import { campaignOpen, currentChapter, playedCampaign, runOf } from "@/lib/game/stats";
import { findCampaign, studentCampaigns } from "@/lib/game/world";
import { isGraded, type Campaign } from "@/lib/story/graph";
import { locate } from "@/lib/story/run";
import { fill } from "@/lib/i18n";
import { questHref } from "@/lib/student/story";
import { BackHeader } from "./back-header";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/07_evidence_journal_2/code.html.
// The case is a campaign: the one named, else the one being played (or the last one played).
// Its clues are listed in story order; the ones the student's run found are open, the newest
// first in view, any other found one opens on a tap. A clue only one branch of the story reveals
// stays sealed for a student who went the other way. The export's pictures with interface painted
// in are replaced by each clue's own illustration.
// `font-headline-lg-mobile` is undefined in the export too, so the clue title renders as body text.

function caseCampaign(facts: Facts, named?: string): Campaign {
  const latest =
    (named ? findCampaign(facts, named) : null) ??
    currentChapter(facts)?.campaign ??
    [...studentCampaigns(facts)].reverse().find((c) => runOf(facts, c.id)) ??
    studentCampaigns(facts)[0];
  return playedCampaign(facts, latest);
}

export function JournalScreen({ campaignId }: { campaignId?: string }) {
  const { t, locale, base, facts } = useStudent();
  const campaign = caseCampaign(facts, campaignId);
  const run = runOf(facts, campaign.id);
  const chapter = (run && locate(campaign, run.ending ?? run.scene)?.chapter) ?? campaign.chapters[0];
  const foundIds = run?.clues ?? [];
  const latestId = foundIds.at(-1) ?? null;
  const [openId, setOpenId] = useState<string | null>(null);
  const shownId = openId && foundIds.includes(openId) ? openId : latestId;
  const clue = shownId ? campaign.clues.find((c) => c.id === shownId)! : null;
  const latestClue = latestId ? campaign.clues.find((c) => c.id === latestId)! : null;
  // The XP of the scene that revealed the newest clue, when it was a graded one.
  const revealedBy = latestId
    ? campaign.chapters.flatMap((c) => c.scenes).find((scene) => "clue" in scene && scene.clue === latestId)
    : null;
  const latestXp = revealedBy && isGraded(revealedBy) ? revealedBy.xp : 0;
  const playing = campaignOpen(facts, campaign) && !run?.ending;
  const percent = campaign.clues.length ? (foundIds.length / campaign.clues.length) * 100 : 0;

  return (
    <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased">
      <BackHeader title={t.journal.title} backHref={questHref(base, campaign, chapter)} profileHref={`${base}/profile`} t={t} />
      <main className="pb-safe bg-background mx-auto w-full max-w-[420px] flex-1 pt-16">
        <div className="flex w-full flex-col space-y-4 pb-8">
          <section className="mx-margin bg-surface p-space-md rounded-xl shadow-md">
            <div className="gap-space-sm mb-space-xs flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-primary text-[14px]">✦</span>
                <span className="font-headline-md text-headline-md text-text-ivory truncate">{tr(campaign.title, locale)}</span>
              </div>
              <span className="bg-surface-container-high text-primary font-label-sm text-caption shrink-0 rounded-full px-2 py-0.5">
                {tr(chapter.label, locale)} • {chapter.cefr}
              </span>
            </div>
            <p className="font-body-md text-caption text-text-muted mb-space-sm">{t.journal.lead}</p>
            <div className="space-y-1.5">
              <div className="font-label-sm text-caption flex items-center justify-between">
                <span className="text-text-muted font-semibold tracking-wider uppercase">{t.journal.collected}</span>
                <span className="text-primary font-semibold">
                  {fill(t.journal.found, { n: foundIds.length, total: campaign.clues.length })}
                </span>
              </div>
              <div className="bg-surface-container-lowest flex h-2 w-full overflow-hidden rounded-full">
                <div
                  className="from-primary-container via-primary to-secondary h-full rounded-full bg-gradient-to-r"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            </div>
          </section>

          {latestClue ? (
            <section className="mx-margin bg-secondary-container/40 p-space-md rounded-xl shadow-lg">
              <div className="gap-space-sm flex items-start">
                <div className="bg-secondary-container mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-[0_0_12px_rgba(208,188,255,0.35)]">
                  <Icon name="auto_fix" className="text-secondary text-[18px]" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="gap-space-xs flex items-center justify-between">
                    <span className="font-label-md text-label-sm text-secondary tracking-widest uppercase">✦ {t.journal.deduction} ✦</span>
                    {latestXp ? (
                      <span className="bg-status-success/20 text-status-success font-label-sm text-caption shrink-0 rounded-full px-2 py-[1px] font-medium">
                        +{latestXp} XP
                      </span>
                    ) : null}
                  </div>
                  <p className="font-body-md text-body-md text-on-surface">{tr(latestClue.deduction, locale)}</p>
                </div>
              </div>
            </section>
          ) : null}

          {clue ? (
            <section className="mx-margin bg-surface overflow-hidden rounded-xl shadow-xl" data-clue={clue.id}>
              <div className="bg-surface-container-high px-space-md flex items-center justify-between py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-primary text-[13px]">✦</span>
                  <span className="font-label-md text-label-sm text-primary tracking-wider uppercase">
                    {shownId === latestId ? t.journal.unlocked : t.journal.studied}
                  </span>
                  <span className="text-primary text-[13px]">✦</span>
                </div>
                <span className="font-label-sm text-caption text-secondary font-semibold">
                  {fill(t.journal.clueNo, { n: campaign.clues.indexOf(clue) + 1 })}
                </span>
              </div>
              <div className="bg-surface-container-lowest relative h-48 w-full overflow-hidden">
                <img className="h-full w-full object-cover" alt="" src={clue.image} />
                <div className="from-surface via-surface/40 absolute inset-0 bg-gradient-to-t to-transparent"></div>
                <div className="bg-surface-container-lowest/80 text-caption font-label-sm text-text-ivory absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 backdrop-blur-md">
                  <Icon name="explore" className="text-primary text-[14px]" />
                  <span>{tr(clue.location, locale)}</span>
                </div>
              </div>
              <div className="p-space-md space-y-space-sm">
                <div className="gap-space-sm flex items-start justify-between">
                  <div>
                    <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-text-ivory leading-tight">
                      {tr(clue.title, locale)}
                    </h2>
                    <span className="font-caption text-caption text-text-muted">{clue.english}</span>
                  </div>
                  <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-[0_0_16px_rgba(185,154,97,0.25)]">
                    <Icon name="vpn_key" className="text-primary text-[22px]" />
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm space-y-1 rounded-lg">
                  <p className="font-body-md text-body-md text-text-ivory leading-relaxed">{tr(clue.description, locale)}</p>
                </div>
                <div className="bg-surface-container p-space-sm gap-space-sm flex items-start rounded-lg">
                  <div className="bg-secondary-container/60 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    <Icon name="school" className="text-secondary text-[14px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-caption text-caption text-secondary font-semibold tracking-wider uppercase">
                      {fill(t.journal.phrase, { cefr: chapter.cefr })}
                    </span>
                    <p className="font-title-sm text-title-sm text-text-ivory mt-0.5 italic">«{clue.phrase.text}»</p>
                    <div className="font-label-sm text-caption mt-1.5 flex flex-wrap gap-1">
                      {clue.phrase.glosses.map((gloss) => (
                        <span key={gloss.word} className="bg-surface-container-high text-primary rounded-sm px-1.5 py-0.5">
                          {gloss.word} • {tr(gloss.meaning, locale)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {clue.tags.map((tag, i) => (
                    <span
                      key={i}
                      className={`bg-surface-container-high font-label-sm text-caption rounded-md px-2 py-1 ${i === 1 ? "text-secondary" : "text-on-surface-variant"}`}
                    >
                      {tr(tag, locale)}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="mx-margin bg-surface p-space-md rounded-xl text-center shadow-md">
              <p className="font-body-md text-body-md text-text-muted">{t.journal.empty}</p>
            </section>
          )}

          <section className="mx-margin space-y-space-sm">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-headline-md text-headline-md text-text-ivory">{t.journal.archive}</h3>
              <span className="font-label-sm text-caption text-text-muted">{fill(t.journal.case, { n: campaign.caseNumber })}</span>
            </div>
            {campaign.clues.map((item, index) => {
              const isFound = foundIds.includes(item.id);
              const final = index === campaign.clues.length - 1;
              if (isFound) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOpenId(item.id)}
                    aria-pressed={shownId === item.id}
                    data-clue-row={item.id}
                    className="bg-surface p-space-sm gap-space-sm flex w-full items-center rounded-xl text-left shadow-xs"
                  >
                    <div className="bg-surface-container-lowest relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                      <img className="h-full w-full object-cover" alt="" src={item.image} />
                      <div className="bg-primary/10 absolute inset-0"></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="gap-space-xs flex items-center justify-between">
                        <h4 className="font-title-sm text-title-sm text-text-ivory truncate">{tr(item.title, locale)}</h4>
                        <span className="text-status-success font-label-sm text-caption flex shrink-0 items-center gap-0.5">
                          <Icon name="check_circle" className="text-[14px]" /> {t.journal.studiedShort}
                        </span>
                      </div>
                      <p className="font-body-md text-caption text-text-muted mt-0.5 truncate">«{item.phrase.text}»</p>
                    </div>
                    <Icon name="chevron_right" className="text-text-muted shrink-0 text-[18px]" />
                  </button>
                );
              }
              const fade = final ? "opacity-35" : index - foundIds.length > 0 ? "opacity-50" : "opacity-65";
              return (
                <div
                  key={item.id}
                  data-clue-row={item.id}
                  className={`p-space-sm gap-space-sm flex items-center rounded-xl ${final ? "bg-surface/40" : "bg-surface/50"} ${fade}`}
                >
                  <div
                    className={`text-text-muted flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${final ? "bg-surface-container-lowest" : "bg-surface-container-low"}`}
                  >
                    <Icon name={final ? "encrypted" : "lock"} className="text-[24px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="gap-space-xs flex items-center justify-between">
                      <h4 className="font-title-sm text-title-sm text-text-muted truncate">{tr(item.title, locale)}</h4>
                      {final ? null : (
                        <span className="bg-surface-container-high text-text-muted font-label-sm text-caption rounded-sm px-1.5 py-0.5">
                          {fill(t.journal.step, { n: index + 1 })}
                        </span>
                      )}
                    </div>
                    <p className="font-body-md text-caption text-text-muted mt-0.5 truncate">{tr(item.teaser, locale)}</p>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="mx-margin pt-space-xs space-y-space-xs">
            <Link
              href={playing ? `${base}/play/${campaign.id}` : `${base}/map`}
              className="from-primary via-primary-container to-primary text-surface-container-lowest font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r tracking-wider uppercase shadow-lg transition-transform duration-100 active:scale-[0.98]"
            >
              <span>{playing ? (latestClue ? tr(latestClue.onward, locale) : t.details.continue) : t.journal.toMap}</span>
              <Icon name="arrow_forward" className="text-[18px]" />
            </Link>
            <div className="font-label-sm text-caption text-text-muted flex items-center justify-center gap-1.5 text-center">
              <span className="text-primary">✦</span>
              <span>{t.journal.reward}</span>
              <span className="text-primary font-semibold">+{chapter.reward.xp} XP</span>
              <span>•</span>
              <span className="text-secondary font-semibold">{fill(t.journal.coins, { n: chapter.reward.coins })}</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
