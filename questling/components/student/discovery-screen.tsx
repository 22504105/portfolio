"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { DAILY_CLAIM_XP } from "@/lib/content/daily";
import { tr } from "@/lib/content/text";
import { useNow, useStudent } from "@/lib/client/student";
import { balance, completed, dailyFor, programDay, PROGRAM_DAYS } from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { fill, LOCALES } from "@/lib/i18n";
import { attemptSeed, shuffled } from "@/lib/learning/shuffle";
import { KeepWord } from "./glossed-text";
import { LineAudioButton } from "./line-audio";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/09_daily_discovery/code.html.
// The day's word and fact come from the academy calendar. The quiz may be retried, as in the
// export; its XP is for a right first try. Claiming the reward also adds the word to the
// student's vocabulary; the fact's bookmark saves the fact. Owner's decision 2026-10-24: the
// header names the screen (the export's "Puzzle Chamber" was copied from 06).
// Tailwind v3 → v4: shadow-sm → shadow-xs, rounded → rounded-sm.

const LETTERS = { ru: ["А", "Б", "В", "Г"], en: ["A", "B", "C", "D"] };

export function DiscoveryScreen() {
  const { t, locale, base, facts, act } = useStudent();
  const today = dayOf(useNow());
  const entry = dailyFor(facts, today);
  const ref = `${entry.id}@${today}`;
  const answers = facts.answers.filter((a) => a.scope === "daily" && a.ref === ref);
  const solved = answers.some((a) => a.correct);
  const wrong = answers.filter((a) => !a.correct).map((a) => a.question);
  const claimed = completed(facts, "daily_claim", today);
  const savedFact = facts.saved.some((s) => s.kind === "fact" && s.ref === entry.id);
  const [other, setOther] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const otherLocale = LOCALES.find((l) => l !== locale) ?? locale;
  const firstTryRight = answers.length > 0 && answers[0].correct;

  function answer(option: string) {
    if (solved || wrong.includes(option) || pending) return;
    setError(false);
    startTransition(async () => {
      const result = await act({ type: "answerDailyQuiz", option });
      if (!result.ok) return setError(true);
      if (result.outcome.kind === "graded" && !result.outcome.correct) {
        setFlash(option);
        setTimeout(() => setFlash(null), 1000);
      }
    });
  }

  function run(action: Parameters<typeof act>[0]) {
    setError(false);
    startTransition(async () => {
      const result = await act(action);
      if (!result.ok) setError(true);
    });
  }

  return (
    <div className="bg-background text-text-ivory flex min-h-dvh flex-col">
      <header className="bg-surface/90 pt-safe fixed inset-x-0 top-0 z-50 shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="px-gutter mx-auto flex h-16 w-full max-w-md items-center justify-between">
          <div className="gap-space-xs flex items-center">
            <Link
              href={`${base}/home`}
              aria-label={t.common.back}
              className="text-primary flex h-11 w-11 items-center justify-center transition-transform active:scale-95"
            >
              <Icon name="arrow_back" className="text-[24px]" />
            </Link>
            <h1 className="font-headline-md text-headline-md text-text-ivory line-clamp-1 tracking-tight">{t.discovery.title}</h1>
          </div>
          <div className="gap-space-sm flex items-center">
            <div className="gap-space-xs bg-surface-container-high px-space-sm flex items-center rounded-full py-1">
              <Icon name="magic_button" className="text-secondary text-[16px]" />
              <span className="font-label-sm text-label-sm text-secondary">{t.puzzle.quest}</span>
            </div>
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

      <main className="pb-safe px-gutter bg-background relative mx-auto flex w-full max-w-md flex-1 flex-col pt-16">
        <div className="flex w-full flex-col pb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="gap-space-xs bg-surface-container flex items-center rounded-full px-3 py-1.5 shadow-xs">
              <Icon name="auto_stories" className="text-primary text-[18px]" />
              <span className="font-label-sm text-label-sm text-on-surface">
                {fill(t.discovery.day, { n: programDay(facts, today), total: PROGRAM_DAYS })}
              </span>
            </div>
            <Link
              href={`${base}/shop`}
              className="gap-space-xs bg-surface-container flex items-center rounded-full px-3 py-1.5 shadow-xs"
              aria-label={t.shop.title}
            >
              <Icon name="monetization_on" filled className="text-primary text-[18px]" />
              <span className="font-label-sm text-label-sm text-primary tracking-wide">{balance(facts, "coins")}</span>
            </Link>
          </div>

          <section className="bg-surface p-space-lg mb-space-lg relative overflow-hidden rounded-xl shadow-lg">
            <div className="bg-secondary-container/20 pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full blur-2xl"></div>
            <div className="bg-primary/10 pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full blur-2xl"></div>
            <div className="mb-space-md flex items-center justify-between">
              <div className="gap-space-xs flex items-center">
                <Icon name="magic_button" className="text-primary text-[18px]" />
                <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase">{t.home.wordOfTheDay}</span>
              </div>
              <span className="bg-surface-container-high text-secondary font-label-sm text-label-sm rounded-full px-2.5 py-0.5 shadow-xs">
                {entry.word.cefr} • Vocabulary
              </span>
            </div>
            <div className="mb-space-md relative h-32 w-full overflow-hidden rounded-lg shadow-md">
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: "url('/images/grand-library.webp')" }}></div>
              <div className="from-surface via-surface/40 absolute inset-0 bg-gradient-to-t to-transparent"></div>
              <div className="absolute right-3 bottom-2 left-3 flex items-end justify-between">
                <div>
                  <h2 className="font-headline-xl-mobile text-headline-xl-mobile text-text-ivory leading-tight tracking-normal" lang="en">
                    {entry.word.text}
                  </h2>
                  <p className="font-body-md text-body-md text-secondary tracking-wide">{entry.word.ipa}</p>
                </div>
                <LineAudioButton
                  text={entry.word.text}
                  src={entry.word.audio}
                  label={t.home.pronounce}
                  action="pronounce-word"
                  className="bg-primary text-on-primary flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-[0_0_16px_rgba(228,194,133,0.35)] transition-transform active:scale-90 disabled:opacity-50"
                >
                  <Icon name="volume_up" className="text-[22px]" />
                </LineAudioButton>
              </div>
            </div>
            <div className="bg-surface-container p-space-md mb-space-md rounded-lg">
              <div className="gap-space-xs mb-1 flex flex-wrap items-center">
                <span className="font-label-sm text-label-sm text-primary">{t.discovery.translation}</span>
                <span className="font-body-md text-body-md text-text-ivory">{tr(entry.word.translation, locale)}</span>
                {tr(entry.word.partOfSpeech, locale) ? (
                  <span className="font-caption text-caption text-text-muted italic">({tr(entry.word.partOfSpeech, locale)})</span>
                ) : null}
              </div>
              <div className="bg-surface-container-lowest/60 mt-2 rounded-sm p-2.5">
                <p className="font-title-sm text-title-sm text-text-ivory italic" lang="en">
                  “{entry.word.example}”
                </p>
                {tr(entry.word.exampleTranslation, locale) ? (
                  <p className="font-caption text-caption text-text-muted mt-1">{tr(entry.word.exampleTranslation, locale)}</p>
                ) : null}
              </div>
              <div className="mt-2 flex flex-col">
                <KeepWord reference={`daily:${today}`} term={entry.word.text} ru={entry.word.translation.ru} />
              </div>
            </div>

            <div className="bg-surface-container-low p-space-md rounded-lg shadow-inner">
              <div className="mb-space-sm flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface">{t.discovery.check}</span>
                <span className="font-label-sm text-label-sm text-primary flex items-center gap-0.5">
                  <Icon name="stars" className="text-[14px]" /> +{entry.quiz.xp} XP
                </span>
              </div>
              <p className="font-body-md text-body-md text-text-ivory mb-space-md">
                {t.discovery.quizLead}{" "}
                <span className="text-primary font-medium italic" lang="en">
                  «{entry.quiz.phrase}»
                </span>
                ?
              </p>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.discovery.check}>
                {shuffled(entry.quiz.options, attemptSeed(facts.profile.joinedAt, `daily:${ref}`)).map((option, i) => {
                  const right = solved && answers.some((a) => a.correct && a.question === option.id);
                  const showWrong = flash === option.id;
                  const ruledOut = wrong.includes(option.id) && !showWrong;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={right}
                      data-option={option.id}
                      disabled={solved || ruledOut || pending}
                      onClick={() => answer(option.id)}
                      className={`flex w-full items-center justify-between rounded-lg p-3 text-left shadow-xs transition-all active:scale-[0.99] ${
                        right
                          ? "bg-status-success/20 text-status-success"
                          : showWrong
                            ? "bg-status-error/20 text-status-error"
                            : "bg-surface text-text-ivory"
                      } ${ruledOut ? "opacity-50" : ""}`}
                    >
                      <div className="gap-space-sm flex items-center">
                        <span className="bg-surface-container-high font-label-sm text-label-sm text-text-muted flex h-6 w-6 items-center justify-center rounded-full">
                          {LETTERS[locale][i]}
                        </span>
                        <span className={`font-body-md text-body-md ${ruledOut ? "line-through" : ""}`}>{tr(option.text, locale)}</span>
                      </div>
                      <Icon
                        name={right ? "check_circle" : showWrong ? "cancel" : "radio_button_unchecked"}
                        className={`text-[18px] ${right ? "text-status-success" : showWrong ? "text-status-error" : "text-text-muted"}`}
                      />
                    </button>
                  );
                })}
              </div>
              {solved ? (
                <div
                  role="status"
                  className="bg-surface-container-high text-status-success font-label-sm text-label-sm mt-3 flex items-center gap-2 rounded-sm p-2.5"
                >
                  <Icon name="verified" className="text-[18px]" />
                  <span>{firstTryRight ? fill(t.discovery.right, { xp: entry.quiz.xp }) : t.discovery.rightLater}</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="bg-surface p-space-lg relative mb-6 overflow-hidden rounded-xl shadow-lg">
            <div className="mb-space-md flex items-center justify-between">
              <div className="gap-space-xs flex items-center">
                <Icon name="menu_book" className="text-secondary text-[20px]" />
                <span className="font-label-sm text-label-sm text-secondary tracking-wider uppercase">{t.discovery.fact}</span>
              </div>
              <span className="font-caption text-caption text-text-muted bg-surface-container-high rounded-sm px-2 py-0.5">
                {fill(t.discovery.archive, { n: entry.fact.archive })}
              </span>
            </div>
            <div className="bg-tertiary text-on-tertiary p-space-md mb-space-md relative rounded-lg shadow-md">
              <div className="mb-2 flex items-start justify-between">
                <span className="font-headline-md text-headline-md text-on-tertiary font-georgia">✦ ✦ ✦</span>
                <button
                  type="button"
                  aria-label={savedFact ? t.discovery.unsave : t.discovery.save}
                  aria-pressed={savedFact}
                  data-action="save-fact"
                  onClick={() => run({ type: "toggleSavedFact" })}
                  className="text-on-tertiary"
                >
                  <Icon name="bookmark" filled={savedFact} className="text-[20px] opacity-85" />
                </button>
              </div>
              <p
                className={`font-title-sm text-title-sm text-on-tertiary font-georgia mb-2 leading-relaxed ${other ? "italic" : ""}`}
                lang={other ? otherLocale : locale}
              >
                «{tr(entry.fact.text, other ? otherLocale : locale)}»
              </p>
              <div className="bg-on-tertiary/10 mt-2 flex items-center justify-between rounded-sm px-2.5 py-1.5 pt-2">
                <div className="text-on-tertiary flex items-center gap-1.5">
                  <Icon name="history_edu" className="text-[16px]" />
                  <span className="font-caption text-caption">{entry.fact.source}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOther((v) => !v)}
              aria-pressed={other}
              className="bg-surface-container-high hover:bg-surface-container-highest text-secondary gap-space-xs flex w-full cursor-pointer items-center justify-center rounded-lg px-3 py-2.5 transition-colors active:scale-95"
            >
              <Icon name="translate" className="text-[18px]" />
              <span className="font-label-sm text-label-sm">{other ? t.discovery.showOwn : t.discovery.showOther}</span>
            </button>
          </section>

          <div className="mt-auto">
            <button
              type="button"
              data-action="claim"
              disabled={claimed || answers.length === 0 || pending}
              onClick={() => run({ type: "claimDaily" })}
              className="text-on-primary flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] shadow-[0_0_16px_rgba(185,154,97,0.3)] transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
            >
              <span className="font-label-md text-label-md text-background font-semibold tracking-wider uppercase">
                {claimed ? t.discovery.claimed : fill(t.discovery.claim, { xp: DAILY_CLAIM_XP })}
              </span>
              {claimed ? null : <Icon name="arrow_forward" className="text-background text-[20px]" />}
            </button>
            {claimed ? (
              <div role="status" className="font-label-sm text-label-sm text-status-success mt-2 text-center">
                ✦ {t.discovery.claimedNote} ✦
              </div>
            ) : answers.length === 0 ? (
              <p className="font-caption text-caption text-text-muted mt-2 text-center">{t.discovery.answerFirst}</p>
            ) : null}
            {error ? (
              <p role="alert" className="font-caption text-caption text-status-error mt-2 text-center">
                {t.common.actionFailed}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
