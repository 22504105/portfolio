"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { quickQuestById, type QuickQuest } from "@/lib/content/quick-quests";
import { tr } from "@/lib/content/text";
import { useNow, useStudent } from "@/lib/client/student";
import { completed, passed, QUESTION_ATTEMPTS, questRef, runState } from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { fill } from "@/lib/i18n";
import { inAttemptOrder, type Answer, type Question } from "@/lib/learning/questions";
import { attemptSeed } from "@/lib/learning/shuffle";
import { LineAudioButton } from "./line-audio";
import { BackHeader } from "./back-header";
import { TileBoard } from "./tile-board";

// Playing a quick quest. There is no Stitch screen for it, so it is put together only from
// parts of approved ones (owner's rule): the story player's header, parchment, option rows and
// check button (05), the puzzle chamber's slots, tiles and feedback banner (06), the quick
// quests' progress bar (08) and the player's reward card (05_story_player_50_xp).

type Feedback = { correct: boolean; explanation: string };

export function QuestRunner({ questId }: { questId: string }) {
  const quest = quickQuestById.get(questId)!;
  const { t, locale, base, facts, act } = useStudent();
  const today = dayOf(useNow());
  const ref = questRef(quest, today);
  const run = runState(facts, quest, ref);
  const isDone = completed(facts, "quest", ref);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rewarded, setRewarded] = useState<{ xp: number; coins: number } | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  // While the last answer's feedback is shown, the question it answered stays on screen.
  const [shownIndex, setShownIndex] = useState(run.current);
  const index = feedback ? shownIndex : run.current;
  const authored = quest.questions[index] as Question | undefined;
  // In this attempt's order: the same after a reload, mixed afresh for another day's attempt.
  const question = authored && inAttemptOrder(authored, attemptSeed(facts.profile.joinedAt, `${ref}|${authored.id}`));

  function submit(answer: Answer) {
    if (!question) return;
    setError(false);
    const asked = run.current;
    startTransition(async () => {
      const result = await act({ type: "answerQuest", questId: quest.id, questionId: question.id, answer });
      if (!result.ok) {
        setError(true);
        return;
      }
      if (result.outcome.kind !== "graded") return;
      setShownIndex(asked);
      setFeedback({ correct: result.outcome.correct, explanation: result.outcome.explanation });
      if (result.outcome.rewarded) setRewarded(result.outcome.rewarded);
    });
  }

  const attemptsHere = question ? run.questions[index].attempts : 0;
  const resolvedHere = question ? run.questions[index].resolved : true;

  return (
    <div
      className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased"
      data-quest-runner={quest.id}
    >
      <BackHeader title={tr(quest.title, locale)} backHref={`${base}/quests`} profileHref={`${base}/profile`} t={t} />
      <main className="bg-background pb-safe px-margin mx-auto w-full max-w-[420px] flex-1 pt-16">
        <div className="space-y-space-md flex w-full flex-col pt-2 pb-8">
          <div className="space-y-space-xs">
            <div className="text-caption font-caption text-text-muted flex items-center justify-between">
              <span>{fill(t.quests.step, { n: Math.min(index + 1, quest.questions.length), total: quest.questions.length })}</span>
              <span className="text-secondary font-medium">{tr(quest.topic, locale)}</span>
            </div>
            <div className="bg-surface-container-lowest flex h-1.5 w-full gap-1 overflow-hidden rounded-full">
              {quest.questions.map((q, i) => (
                <div
                  key={q.id}
                  className={`h-full flex-1 rounded-full ${run.questions[i].resolved ? (run.questions[i].correct ? "bg-secondary" : "bg-status-error/70") : "bg-surface-container-high"}`}
                ></div>
              ))}
            </div>
          </div>

          {isDone && !feedback ? (
            <Finished quest={quest} correct={run.correctCount} passedRun={passed(run)} rewarded={rewarded} />
          ) : question ? (
            <QuestionView
              key={`${question.id}-${attemptsHere}-${feedback ? "f" : "q"}`}
              question={question}
              attempt={Math.min(attemptsHere + (feedback ? 0 : 1), QUESTION_ATTEMPTS)}
              locked={!!feedback || pending}
              onSubmit={submit}
            />
          ) : null}

          {feedback ? (
            <div
              role="status"
              className={`p-space-md text-text-ivory w-full rounded-xl shadow-lg ${feedback.correct ? "bg-[#152e25]" : "bg-[#331619]"}`}
            >
              <div className="gap-space-sm flex items-center">
                <Icon
                  name={feedback.correct ? "check_circle" : "lock"}
                  className={`text-[28px] ${feedback.correct ? "text-status-success" : "text-status-error"}`}
                />
                <div className="flex flex-col">
                  <h4 className={`font-headline-md text-title-sm ${feedback.correct ? "text-status-success" : "text-status-error"}`}>
                    {feedback.correct
                      ? t.player.correct
                      : resolvedHere
                        ? t.quests.outOfAttempts
                        : fill(t.quests.tryAgain, { n: QUESTION_ATTEMPTS - attemptsHere })}
                  </h4>
                  <p className="font-body-md text-body-md">{feedback.explanation}</p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="font-caption text-caption text-status-error text-center">
              {t.common.actionFailed}
            </p>
          ) : null}

          {feedback ? (
            <button
              type="button"
              data-action="next"
              onClick={() => setFeedback(null)}
              className="font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e4c285] to-[#b99a61] font-semibold tracking-wider text-[#271900] uppercase shadow-[0_6px_20px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98]"
            >
              <span>{run.finished ? t.quests.seeResult : resolvedHere ? t.quests.nextQuestion : t.player.retry}</span>
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Finished({
  quest,
  correct,
  passedRun,
  rewarded,
}: {
  quest: QuickQuest;
  correct: number;
  passedRun: boolean;
  rewarded: { xp: number; coins: number } | null;
}) {
  const { t, base } = useStudent();
  return (
    <>
      <div
        role="status"
        className="border-primary/30 from-surface-container-high to-surface-container p-space-md relative overflow-hidden rounded-xl border bg-gradient-to-br shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
      >
        <div className="bg-primary/10 pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-xl"></div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-primary text-[10px]">✦</span>
            <span className="font-label-sm text-label-sm text-primary font-semibold tracking-widest uppercase">
              {passedRun ? t.quests.passed : t.quests.notPassed}
            </span>
            <span className="text-primary text-[10px]">✦</span>
          </div>
          {passedRun ? (
            <div className="border-status-success/40 bg-status-success/20 flex items-center gap-1 rounded-full border px-2.5 py-0.5">
              <Icon name="stars" filled className="text-status-success text-[14px]" />
              <span className="font-label-md text-label-md text-status-success font-bold">+{rewarded?.xp ?? quest.xp} XP</span>
            </div>
          ) : null}
        </div>
        <p className="font-body-md text-body-md text-text-ivory">{fill(t.quests.score, { n: correct, total: quest.questions.length })}</p>
        <p className="font-caption text-caption text-text-muted mt-1">
          {passedRun ? fill(t.quests.earned, { xp: rewarded?.xp ?? quest.xp, coins: rewarded?.coins ?? quest.coins }) : t.quests.noReward}
        </p>
      </div>
      <Link
        href={`${base}/quests`}
        className="font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e4c285] to-[#b99a61] font-semibold tracking-wider text-[#271900] uppercase shadow-[0_6px_24px_rgba(185,154,97,0.45)] transition-all active:scale-[0.98]"
      >
        <span>{t.quests.back}</span>
        <Icon name="arrow_forward" className="text-[20px]" />
      </Link>
    </>
  );
}

function QuestionView({
  question,
  attempt,
  locked,
  onSubmit,
}: {
  question: Question;
  attempt: number;
  locked: boolean;
  onSubmit: (answer: Answer) => void;
}) {
  const { t, locale } = useStudent();
  const [choice, setChoice] = useState<string | null>(null);
  const [many, setMany] = useState<string[]>([]);
  const tiles =
    question.kind === "fill" ? question.bank : question.kind === "order" ? question.tiles : question.kind === "match" ? question.right : [];
  const slotCount =
    question.kind === "fill" ? 1 : question.kind === "order" ? question.tiles.length : question.kind === "match" ? question.left.length : 0;
  const [slots, setSlots] = useState<(string | null)[]>(() => Array.from({ length: slotCount }, () => null));

  const ready =
    question.kind === "choice" ? choice !== null : question.kind === "multi" ? many.length > 0 : slots.every((slot) => slot !== null);

  function check() {
    if (!ready) return;
    switch (question.kind) {
      case "choice":
        return onSubmit({ kind: "choice", option: choice! });
      case "multi":
        return onSubmit({ kind: "multi", options: many });
      case "fill":
        return onSubmit({ kind: "fill", word: slots[0]! });
      case "order":
        return onSubmit({ kind: "order", tiles: slots as string[] });
      case "match":
        return onSubmit({ kind: "match", pairs: Object.fromEntries(question.left.map((left, i) => [left, slots[i]!])) });
    }
  }

  const audio = question.kind === "choice" ? question.audio : undefined;
  const passage = question.kind === "choice" ? question.passage : question.kind === "fill" ? question.sentence : undefined;

  return (
    <>
      <div className="bg-surface-container-low p-space-md relative w-full overflow-hidden rounded-xl shadow-xl">
        <div className="bg-secondary-container/20 pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl"></div>
        <div className="mb-space-sm relative z-10 flex items-center justify-between">
          <div className="gap-space-xs flex items-center">
            <Icon name="lock_open" className="text-primary text-[18px]" />
            <span className="font-label-sm text-label-sm text-text-muted tracking-wider uppercase">{t.quests.question}</span>
          </div>
          <div className="gap-space-xs bg-surface-container-highest/80 px-space-sm flex items-center rounded-full py-1 shadow-inner">
            <span className="font-caption text-caption text-text-ivory mr-1">
              {fill(t.player.attempt, { used: attempt, max: QUESTION_ATTEMPTS })}
            </span>
            {Array.from({ length: QUESTION_ATTEMPTS }, (_, i) => (
              <div
                key={i}
                className={`h-2.5 w-2.5 rotate-45 rounded-[1px] ${i < QUESTION_ATTEMPTS - attempt + 1 ? "bg-secondary shadow-[0_0_8px_rgba(208,188,255,0.8)]" : "bg-surface-variant opacity-30"}`}
              ></div>
            ))}
          </div>
        </div>
        <p className="font-body-md text-body-md text-text-ivory relative z-10 leading-relaxed">{tr(question.prompt, locale)}</p>
      </div>

      {audio ? (
        <LineAudioButton
          text={audio}
          action="listen-quest"
          className="bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md flex h-11 w-full items-center justify-center gap-2 rounded-lg uppercase shadow-xs transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          {({ availability }) => (
            <>
              <Icon name="headphones" className="text-primary text-[18px]" />
              <span>{availability === "none" ? t.quests.noSpeech : t.quests.listen}</span>
            </>
          )}
        </LineAudioButton>
      ) : null}

      {passage ? (
        <div className="relative overflow-hidden rounded-xl bg-[#D9C49B] p-4 text-[#231D15] shadow-[0_12px_32px_rgba(0,0,0,0.7)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#edd9b4]/50 via-transparent to-[#947e54]/30"></div>
          <p className="font-georgia relative text-center text-[18px] leading-snug italic">
            {question.kind === "fill" ? passage.replace("___", slots[0] ? `[${slots[0]}]` : "_____") : `“${passage}”`}
          </p>
        </div>
      ) : null}

      {question.kind === "choice" || question.kind === "multi" ? (
        <div
          className="gap-space-sm flex flex-col"
          role={question.kind === "choice" ? "radiogroup" : "group"}
          aria-label={t.player.options}
        >
          {question.options.map((option) => {
            const selected = question.kind === "choice" ? choice === option.id : many.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role={question.kind === "choice" ? "radio" : "checkbox"}
                aria-checked={selected}
                data-option={option.id}
                disabled={locked}
                onClick={() =>
                  question.kind === "choice"
                    ? setChoice(option.id)
                    : setMany((current) =>
                        current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id],
                      )
                }
                className={`group bg-surface-container px-space-md py-space-sm relative flex min-h-[58px] w-full items-center justify-between rounded-xl transition-all duration-200 ${
                  selected ? "shadow-[0_0_18px_rgba(228,194,133,0.18)]" : "opacity-90 hover:opacity-100"
                }`}
              >
                <span className="font-title-sm text-title-sm text-text-ivory text-left tracking-wide">{option.text}</span>
                <div
                  className={`bg-surface-container-highest flex h-6 w-6 shrink-0 items-center justify-center ${question.kind === "choice" ? "rounded-full" : "rounded-md"}`}
                >
                  <div
                    className={`h-3 w-3 ${question.kind === "choice" ? "rounded-full" : "rounded-sm"} ${selected ? "bg-primary shadow-[0_0_8px_#e4c285]" : "bg-transparent"}`}
                  ></div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <TileBoard
          t={t}
          tiles={tiles}
          slots={slots}
          onChange={setSlots}
          disabled={locked}
          slotLabels={question.kind === "match" ? question.left : undefined}
          title={question.kind === "match" ? t.quests.pairs : question.kind === "fill" ? t.quests.gap : undefined}
        />
      )}

      {locked ? null : (
        <button
          type="button"
          data-action="check"
          onClick={check}
          disabled={!ready}
          className="font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e4c285] to-[#b99a61] font-semibold tracking-wider text-[#271900] uppercase shadow-[0_6px_20px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{t.player.check}</span>
          <Icon name="chevron_right" className="text-[18px]" />
        </button>
      )}
    </>
  );
}
