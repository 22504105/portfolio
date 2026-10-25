"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import { useReducer, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { fill, type Dictionary } from "@/lib/i18n";
import { canCheck, initialState, reduce, type QuestionState } from "@/lib/story/engine";
import type { GradeResult, QuestionNode } from "@/lib/story/types";
import { BackHeader } from "./back-header";
import { useLineAudio } from "@/lib/client/audio";
import { useMediaLink } from "@/lib/client/student";
import { ExhaustedView, GrimoireSheet } from "./story-help";

// The story player for a question or a piece of evidence. Ported from the Stitch story-player screens:
//   answering — 01_APPROVED_SCREENS/05_story_player_2
//   correct   — 02_STORY_STATES/05_story_player_50_xp
//   incorrect — 02_STORY_STATES/05_story_player_3
//   exhausted — 02_STORY_STATES/05_story_player_4      (story-help.tsx)
//   grimoire  — 02_STORY_STATES/05_story_player_never_2 (story-help.tsx)
// Evidence uses the same screens, its options being the clues found (each with its picture).
// Grading is passed in: the demo grades in the browser, a real run asks the server.
//
// Font note: the export's class order makes the parchment texts fall back to ui-serif;
// the approved screenshots show Georgia. `font-georgia` puts Gelasio, its free metric twin, first.

export type Grader = (nodeId: string, optionId: string) => Promise<GradeResult>;

/** The ways on from a scene with no attempts left (05_story_player_4). */
export type Help = {
  group: string | null;
  asked: boolean;
  /** The mentor's latest reply about this scene, if any. */
  reply: { body: string; mentor: string } | null;
  onAsk: () => Promise<boolean>;
  /** The grimoire's word, checked by the rules: true when an attempt is back. */
  onStudy: (word: string) => Promise<boolean>;
};

type Props = {
  t: Dictionary;
  node: QuestionNode;
  grade: Grader;
  /** Where the run left this scene: attempts used and options ruled out. */
  initial?: { attemptsUsed: number; eliminated: string[] };
  backHref: string;
  profileHref: string;
  /** "К следующей улике": the story moves on. */
  onNext: () => void;
  /** The story map: where a student with no attempts left can go back to. */
  exitHref: string;
  help: Help;
};

export function StoryPlayer({ t, node, grade, initial, backHref, profileHref, onNext, exitHref, help }: Props) {
  const [state, dispatch] = useReducer(
    (s: QuestionState, a: Parameters<typeof reduce>[2]) => reduce(node, s, a),
    null,
    () => initialState(node, initial),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function check() {
    const optionId = state.selected;
    if (!canCheck(state) || optionId === null) return;
    setError(null);
    startTransition(async () => {
      try {
        dispatch({ type: "graded", result: await grade(node.id, optionId) });
      } catch {
        setError(t.player.checkFailed);
      }
    });
  }

  return (
    <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased" data-phase={state.phase}>
      {/* The approved screens say "Quest Details" here; the owner chose real screen names (conflict 1). */}
      <BackHeader title={t.player.title} backHref={backHref} profileHref={profileHref} t={t} />
      {state.phase === "exhausted" || state.phase === "grimoire" ? (
        <>
          <ExhaustedView
            t={t}
            node={node}
            attemptsUsed={state.attemptsUsed}
            tried={node.options.filter((o) => state.eliminated.includes(o.id)).map((o) => o.label)}
            group={help.group}
            asked={help.asked}
            reply={help.reply}
            onAsk={help.onAsk}
            onOpenGrimoire={() => dispatch({ type: "openGrimoire" })}
            mapHref={exitHref}
          />
          {state.phase === "grimoire" ? (
            <GrimoireSheet
              t={t}
              node={node}
              onStudy={help.onStudy}
              onClose={() => dispatch({ type: "closeGrimoire" })}
              onApply={() => dispatch({ type: "grimoirePassed" })}
            />
          ) : null}
        </>
      ) : state.phase === "incorrect" ? (
        <IncorrectView
          t={t}
          node={node}
          state={state}
          onSelect={(optionId) => dispatch({ type: "select", optionId })}
          onRetry={() => dispatch({ type: "retry" })}
        />
      ) : (
        <main className="bg-background pb-safe mx-auto w-full max-w-[420px] flex-1 pt-16">
          <div className="flex w-full flex-col">
            <StoryHeading chapter={node.chapter} cefr={node.cefr} title={node.storyTitle} />
            <SceneImage image={node.image} location={node.location} />
            <Stepper t={t} node={node} solved={state.phase === "correct"} />
            <div className="mb-space-sm px-margin text-center">
              <p className="font-body-md text-body-md text-text-ivory leading-relaxed">
                {node.prompt.lead}
                <br />
                <span className="text-text-muted">{node.prompt.task || (node.evidence ? t.story.evidenceTask : "")}</span>
              </p>
            </div>
            <Parchment text={node.clue.text} listen={node.listen && state.phase !== "correct"} audio={node.audio} t={t} />
            {state.phase === "correct" ? (
              <CorrectOptions t={t} node={node} state={state} />
            ) : (
              <div className="mb-space-xl gap-space-sm px-margin flex flex-col" role="radiogroup" aria-label={t.player.options}>
                {node.options.map((option) => {
                  // An option already answered wrong stays listed but can no longer be chosen.
                  if (state.eliminated.includes(option.id)) return <RuledOutOption key={option.id} option={option} />;
                  const selected = state.selected === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-option={option.id}
                      onClick={() => dispatch({ type: "select", optionId: option.id })}
                      className={`group bg-surface-container px-space-md py-space-sm relative flex min-h-[58px] w-full items-center justify-between rounded-xl transition-all duration-200 ${
                        selected ? "shadow-[0_0_18px_rgba(228,194,133,0.18)]" : "opacity-90 hover:opacity-100"
                      }`}
                    >
                      <div className="gap-space-md flex items-center">
                        <div
                          className={`group-hover:text-primary flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            selected ? "bg-surface-container-high text-primary" : "bg-surface-container-low text-text-muted"
                          }`}
                        >
                          <OptionPicture option={option} size="text-[22px]" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-title-sm text-title-sm text-text-ivory tracking-wide">{option.label}</span>
                          <span className="font-caption text-caption text-text-muted">{option.gloss}</span>
                        </div>
                      </div>
                      <div className="bg-surface-container-highest flex h-6 w-6 items-center justify-center rounded-full">
                        <div
                          className={`h-3 w-3 rounded-full ${selected ? "bg-primary shadow-[0_0_8px_#e4c285]" : "bg-transparent"}`}
                        ></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {state.phase === "correct" ? <RewardCard t={t} node={node} xp={state.xpGranted} /> : null}
            <div className="px-margin pb-space-lg flex flex-col items-center">
              {state.phase === "correct" ? (
                <button
                  type="button"
                  data-action="next"
                  onClick={onNext}
                  className="font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e4c285] to-[#b99a61] font-semibold tracking-wider text-[#271900] uppercase shadow-[0_6px_24px_rgba(185,154,97,0.45)] transition-all hover:brightness-105 active:scale-[0.98] motion-safe:animate-pulse"
                >
                  <span>{t.player.nextClue}</span>
                  <Icon name="arrow_forward" className="text-[20px]" />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    data-action="check"
                    onClick={check}
                    disabled={!canCheck(state) || pending}
                    aria-busy={pending}
                    className="font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e4c285] to-[#b99a61] font-semibold tracking-wider text-[#271900] uppercase shadow-[0_6px_20px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{pending ? t.player.checking : t.player.check}</span>
                    <Icon name="chevron_right" className="text-[18px]" />
                  </button>
                  {error ? (
                    <p role="alert" className="mt-space-sm font-caption text-caption text-status-error text-center">
                      {error}
                    </p>
                  ) : null}
                  <div className="mt-space-md bg-surface-container-high px-space-md flex items-center gap-2 rounded-full py-1.5">
                    <Icon name="explore" filled className="text-primary text-[18px]" />
                    <span className="font-label-md text-label-md text-primary font-medium tracking-wide">+{node.reward.xp} XP</span>
                    <span className="text-text-muted text-[10px]">✦</span>
                    <span className="font-caption text-caption text-text-muted">{t.player.rewardChip}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

/** The chapter, its CEFR level and the story's title, above the scene (05_story_player_2). */
export function StoryHeading({ chapter, cefr, title }: { chapter: string; cefr: string; title: string }) {
  return (
    <div className="px-margin pt-space-xs pb-space-sm flex flex-col items-center">
      <div className="flex w-full items-center justify-between">
        <div className="gap-space-xs flex items-center">
          <span className="text-primary text-[10px]">✦</span>
          <span className="font-label-sm text-label-sm text-primary tracking-widest uppercase">{chapter}</span>
          <span className="text-primary text-[10px]">✦</span>
        </div>
        <div className="bg-secondary-container/40 px-space-sm rounded-full py-[2px]">
          <span className="font-label-sm text-label-sm text-secondary font-medium tracking-wider">{cefr}</span>
        </div>
      </div>
      {/* The export's `font-headline-lg-mobile` is undefined, so the title renders as body text; kept as approved. */}
      <h2 className="mt-space-xs font-body-md text-body-md text-text-ivory text-center tracking-tight">{title}</h2>
    </div>
  );
}

/** The scene's picture with its place, as the approved player shows it. */
export function SceneImage({ image, location }: { image: string; location: string }) {
  return (
    <div className="mb-space-md px-margin">
      <div className="bg-surface-container relative h-[178px] w-full overflow-hidden rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
        <img className="h-full w-full object-cover" alt={location} src={image} />
        <div className="from-background pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent to-black/30"></div>
        <div className="bg-surface-dim/80 absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 backdrop-blur-md">
          <span className="bg-primary h-1.5 w-1.5 rounded-full shadow-[0_0_8px_#e4c285] motion-safe:animate-pulse"></span>
          <span className="font-caption text-caption text-text-muted">{location}</span>
        </div>
      </div>
    </div>
  );
}

function Stepper({ t, node, solved }: { t: Dictionary; node: QuestionNode; solved: boolean }) {
  const steps = Array.from({ length: node.clue.total }, (_, i) => i + 1);
  // Once solved, the current clue counts as done and the next one is the active step.
  const done = solved ? node.clue.index : node.clue.index - 1;
  return (
    <div className="mb-space-md px-margin flex flex-col items-center">
      <div className="mb-space-sm text-text-muted flex items-center gap-1.5">
        <span className="text-primary text-[9px]">✦</span>
        <span className="font-caption text-caption text-on-surface-variant font-medium tracking-wider uppercase">
          {fill(t.player.clueOf, { n: node.clue.index, total: node.clue.total })}
        </span>
        <span className="text-primary text-[9px]">✦</span>
      </div>
      <div
        className="px-space-sm flex w-full max-w-[270px] items-center justify-center"
        role="progressbar"
        aria-label={t.player.clues}
        aria-valuemin={0}
        aria-valuemax={node.clue.total}
        aria-valuenow={done}
      >
        {steps.map((step) => {
          const isDone = step <= done;
          const isActive = step === done + 1;
          const justSolved = solved && step === node.clue.index;
          return (
            <StepWithRay key={step} last={step === node.clue.total} ray={rayFor(step, done, solved)}>
              {isDone ? (
                <div
                  className={`bg-primary flex h-3.5 w-3.5 items-center justify-center rounded-full ${
                    justSolved
                      ? "ring-primary/40 shadow-[0_0_12px_rgba(228,194,133,0.9)] ring-2"
                      : "shadow-[0_0_10px_rgba(228,194,133,0.6)]"
                  }`}
                >
                  <Icon name="check" className="text-on-primary text-[10px] font-bold" />
                </div>
              ) : isActive && solved ? (
                <div className="border-primary/50 bg-surface-container-high flex h-3.5 w-3.5 items-center justify-center rounded-full border shadow-[0_0_8px_rgba(228,194,133,0.3)]">
                  <div className="bg-primary h-1.5 w-1.5 rounded-full"></div>
                </div>
              ) : isActive ? (
                <div className="bg-surface-container-high flex h-4 w-4 items-center justify-center rounded-full p-0.5 shadow-[0_0_12px_rgba(208,188,255,0.7)]">
                  <div className="bg-secondary h-2.5 w-2.5 rounded-full"></div>
                </div>
              ) : (
                <div className="bg-surface-container-highest h-2.5 w-2.5 rounded-full"></div>
              )}
            </StepWithRay>
          );
        })}
      </div>
    </div>
  );
}

function rayFor(step: number, done: number, solved: boolean): string {
  if (step < done) return "bg-primary shadow-[0_0_6px_rgba(228,194,133,0.4)]";
  if (step === done && solved) return "bg-gradient-to-r from-primary to-surface-container-highest";
  return "bg-surface-container-highest";
}

function StepWithRay({ children, ray, last }: { children: React.ReactNode; ray: string; last: boolean }) {
  return (
    <>
      <div className="relative flex items-center justify-center">{children}</div>
      {last ? null : <div className={`h-[2px] flex-1 ${ray}`}></div>}
    </>
  );
}

/** The parchment with the scene's English line; for a listening riddle, a button that reads it aloud instead. */
export function Parchment({ text, listen = false, audio, t }: { text: string; listen?: boolean; audio?: string; t?: Dictionary }) {
  if (listen && t) return <ListenParchment text={text} audioId={audio} t={t} />;
  return (
    <div className="mb-space-lg px-margin">
      <div className="p-space-lg relative overflow-hidden rounded-xl bg-[#D9C49B] text-[#231D15] shadow-[0_12px_32px_rgba(0,0,0,0.7)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#edd9b4]/50 via-transparent to-[#947e54]/30"></div>
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-1 text-xs whitespace-pre text-[#6E5A3A] opacity-70">✦ ✤ ✦</div>
          <blockquote className="px-space-xs font-georgia text-headline-md leading-snug text-[#231D15] italic">“{text}”</blockquote>
          <div className="mt-space-sm flex w-28 items-center gap-2 opacity-60">
            <div className="h-[1px] flex-1 bg-[#6E5A3A]"></div>
            <span className="text-[9px] text-[#6E5A3A]">✦</span>
            <div className="h-[1px] flex-1 bg-[#6E5A3A]"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CorrectOptions({ t, node, state }: { t: Dictionary; node: QuestionNode; state: QuestionState }) {
  return (
    <div className="mb-space-xl gap-space-sm px-margin flex flex-col">
      {node.options.map((option) =>
        option.id === state.last?.optionId ? (
          <div
            key={option.id}
            data-option={option.id}
            className="p-space-md relative flex w-full flex-col gap-2 rounded-xl border border-[#63BA9E] bg-[#63BA9E]/10 shadow-[0_0_24px_rgba(99,186,158,0.22)] transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="gap-space-md flex items-center">
                <div className="text-status-success flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-[#63BA9E]/40 bg-[#63BA9E]/20">
                  <OptionPicture option={option} size="text-[24px]" />
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-title-sm text-title-sm text-text-ivory tracking-wide">{option.label}</span>
                    <span className="bg-status-success/20 text-status-success flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                      <Icon name="done_all" className="text-[12px]" /> {t.player.correct}
                    </span>
                  </div>
                  <span className="font-caption text-caption text-text-muted">{option.gloss}</span>
                </div>
              </div>
              <div className="bg-status-success flex h-7 w-7 items-center justify-center rounded-full shadow-[0_0_12px_rgba(99,186,158,0.7)]">
                <Icon name="check" className="text-surface text-[16px] font-bold" />
              </div>
            </div>
            <div className="mt-1 flex items-start gap-2 border-t border-[#63BA9E]/20 pt-2">
              <Icon name="auto_stories" className="text-status-success mt-0.5 text-[16px]" />
              <p className="font-georgia text-text-ivory/90 text-[13px] leading-snug italic">{state.last.explanation}</p>
            </div>
          </div>
        ) : (
          <RuledOutOption key={option.id} option={option} />
        ),
      )}
    </div>
  );
}

/** An option that is out of play: struck through and faded, as the correct-state screen draws the others. */
function RuledOutOption({ option }: { option: QuestionNode["options"][number] }) {
  return (
    <div
      data-option={option.id}
      aria-disabled="true"
      className="bg-surface-container px-space-md py-space-sm pointer-events-none relative flex min-h-[54px] w-full items-center justify-between rounded-xl opacity-40"
    >
      <div className="gap-space-md flex items-center">
        <div className="bg-surface-container-low text-text-muted flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
          <OptionPicture option={option} size="text-[22px]" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-title-sm text-title-sm text-text-muted tracking-wide line-through">{option.label}</span>
          <span className="font-caption text-caption text-text-muted">{option.gloss}</span>
        </div>
      </div>
      <div className="bg-surface-container-highest flex h-6 w-6 items-center justify-center rounded-full">
        <div className="h-2.5 w-2.5 rounded-full bg-transparent"></div>
      </div>
    </div>
  );
}

function RewardCard({ t, node, xp }: { t: Dictionary; node: QuestionNode; xp: number }) {
  return (
    <div className="mb-space-lg px-margin">
      <div
        role="status"
        className="border-primary/30 from-surface-container-high to-surface-container p-space-md relative overflow-hidden rounded-xl border bg-gradient-to-br shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
      >
        <div className="bg-primary/10 pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-xl"></div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-primary text-[10px]">✦</span>
            <span className="font-label-sm text-label-sm text-primary font-semibold tracking-widest uppercase">
              {node.clue.title ? t.player.solved : t.story.proofTitle}
            </span>
            <span className="text-primary text-[10px]">✦</span>
          </div>
          <div className="border-status-success/40 bg-status-success/20 flex items-center gap-1 rounded-full border px-2.5 py-0.5">
            <Icon name="stars" filled className="text-status-success text-[14px]" />
            <span className="font-label-md text-label-md text-status-success font-bold">+{xp} XP</span>
          </div>
        </div>
        <div className="gap-space-sm mt-1 flex items-start">
          <div className="border-primary/40 text-primary mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border bg-[#b99a61]/20">
            <Icon name="menu_book" className="text-[20px]" />
          </div>
          <div className="flex flex-col">
            <span className="font-title-sm text-title-sm text-text-ivory">
              {node.clue.title ? t.player.journalTitle : t.story.proofTitle}
            </span>
            <p className="font-caption text-caption text-text-muted mt-0.5">
              {node.clue.title ? fill(t.player.journalText, { title: node.clue.title }) : t.story.proofText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncorrectView({
  t,
  node,
  state,
  onSelect,
  onRetry,
}: {
  t: Dictionary;
  node: QuestionNode;
  state: QuestionState;
  onSelect: (optionId: string) => void;
  onRetry: () => void;
}) {
  const [showTranslation, setShowTranslation] = useState(false);
  const wrong = node.options.find((o) => o.id === state.last?.optionId);
  const remaining = node.options.filter((o) => !state.eliminated.includes(o.id));
  const steps = Array.from({ length: node.clue.total }, (_, i) => i + 1);
  return (
    <main className="bg-background pb-safe mx-auto w-full max-w-[420px] flex-1 pt-16">
      <div className="gap-space-lg px-margin pb-space-xl flex w-full flex-col">
        <div className="pt-space-xs flex items-center justify-between">
          <div className="gap-space-xs flex items-center">
            <span className="font-caption text-caption text-primary flex items-center gap-1 font-semibold tracking-widest uppercase">
              ✦ {node.chapter} ✦
            </span>
          </div>
          <span className="bg-surface-container-high font-label-sm text-label-sm text-primary rounded-full px-2.5 py-0.5 font-medium shadow-xs">
            CEFR {node.cefr}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-headline-xl-mobile text-headline-xl-mobile text-text-ivory leading-tight tracking-wide">{node.storyTitle}</h2>
          <p className="font-caption text-caption text-text-muted flex items-center gap-1.5">
            <Icon name="auto_stories" className="text-primary text-[14px]" />
            {t.player.mode}
          </p>
        </div>
        <div className="bg-surface-container-lowest relative h-44 w-full overflow-hidden rounded-xl shadow-lg">
          <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url('${node.image}')` }}></div>
          <div className="from-surface via-surface/40 absolute inset-0 bg-gradient-to-t to-transparent"></div>
          <div className="bg-surface/90 absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1 shadow-md backdrop-blur-md">
            <Icon name="local_library" filled className="text-primary text-[15px]" />
            <span className="font-label-sm text-label-sm text-text-ivory font-medium tracking-wide">{node.location}</span>
          </div>
          <div className="bg-error-container/80 font-caption text-caption text-on-error-container absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur-md">
            <Icon name="history" className="text-[13px]" />
            <span>{fill(t.player.attempt, { used: state.attemptsUsed, max: node.maxAttempts })}</span>
          </div>
        </div>

        <div className="gap-space-sm bg-surface-container p-space-md flex flex-col rounded-xl shadow-md">
          <div className="font-caption text-caption text-text-muted flex items-center justify-between">
            <span className="text-primary font-semibold tracking-wider uppercase">
              ✦ {fill(t.player.clueOf, { n: node.clue.index, total: node.clue.total })} ✦
            </span>
            <span className="text-error flex items-center gap-1 font-medium">
              <span className="bg-status-error h-1.5 w-1.5 rounded-full motion-safe:animate-ping"></span>
              {t.player.chooseAgainNeeded}
            </span>
          </div>
          <div className="flex w-full items-center justify-between pt-1">
            {steps.map((step) => (
              <StepWithRay
                key={step}
                last={step === node.clue.total}
                ray={step < node.clue.index ? "mx-1 h-0.5 bg-status-success/70" : "mx-1 h-0.5 bg-surface-container-highest"}
              >
                {step < node.clue.index ? (
                  <div className="bg-status-success font-label-sm text-surface flex h-8 w-8 items-center justify-center rounded-full font-bold shadow-[0_0_12px_rgba(99,186,158,0.4)]">
                    <Icon name="check" className="text-[18px]" />
                  </div>
                ) : step === node.clue.index ? (
                  <div className="bg-status-error font-label-sm text-surface relative flex h-8 w-8 items-center justify-center rounded-full font-bold shadow-[0_0_16px_rgba(232,132,132,0.6)] motion-safe:animate-pulse">
                    <Icon name="close" className="text-[18px]" />
                  </div>
                ) : (
                  <div className="bg-surface-container-high font-caption text-text-muted flex h-7 w-7 items-center justify-center rounded-full">
                    {step === node.clue.total ? <Icon name="lock" className="text-[14px]" /> : step}
                  </div>
                )}
              </StepWithRay>
            ))}
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant pt-2 leading-relaxed">
            {node.prompt.lead} {node.prompt.task}
          </p>
        </div>

        <div className="p-space-lg relative w-full overflow-hidden rounded-xl bg-[#D9C49B] text-[#231D15] shadow-[0_10px_28px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between pb-1 text-[12px] opacity-60">
            <span>✦</span>
            <span className="font-georgia text-[11px] font-semibold tracking-widest uppercase">{t.player.fragment}</span>
            <span>✦</span>
          </div>
          <div className="py-space-sm flex flex-col items-center text-center">
            <Icon name="menu_book" className="mb-1 text-[26px] text-[#725C37] opacity-80" />
            <blockquote className="font-georgia text-headline-md max-w-[90%] leading-snug tracking-wide text-[#1E1710] italic">
              “{node.clue.text}”
            </blockquote>
            {showTranslation ? <p className="mt-space-sm font-body-md text-body-md text-[#483B2A]">{node.translation}</p> : null}
          </div>
          <div className="flex items-center justify-between pt-1 text-[12px] opacity-60">
            <span>✦</span>
            <span className="font-caption text-caption tracking-wider text-[#483B2A]">{t.player.whereIsKey}</span>
            <span>✦</span>
          </div>
        </div>

        <div className="gap-space-sm flex flex-col">
          <div className="flex items-center justify-between px-1">
            <span className="font-label-md text-label-md text-text-ivory">{t.player.options}</span>
            <span className="font-caption text-caption text-text-muted">{t.player.chooseAgain}</span>
          </div>
          {wrong ? (
            <div className="bg-surface-container-high p-space-md flex flex-col rounded-xl shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="gap-space-sm flex items-center">
                  <div className="bg-status-error text-surface flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                    <Icon name="close" className="text-[16px] font-bold" />
                  </div>
                  <span className="font-title-sm text-title-sm text-text-ivory line-through opacity-75">{wrong.label}</span>
                </div>
                <span className="bg-error-container font-caption text-caption text-on-error-container rounded-sm px-2 py-0.5 font-semibold tracking-wider">
                  {t.player.wrong}
                </span>
              </div>
              <div className="font-body-md text-body-md text-error mt-2.5 bg-transparent pt-2 pl-9 leading-relaxed">
                {state.last?.explanation}
              </div>
            </div>
          ) : null}
          {remaining.map((option) => (
            <button
              key={option.id}
              type="button"
              data-option={option.id}
              onClick={() => onSelect(option.id)}
              className="group bg-surface p-space-md hover:bg-surface-container-high flex cursor-pointer items-center justify-between rounded-xl text-left shadow-xs transition-colors active:scale-[0.99]"
            >
              <div className="gap-space-sm flex items-center">
                <div className="bg-surface-container-highest group-hover:bg-primary-container flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors">
                  <Icon name="flare" className="text-primary text-[16px] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="flex flex-col">
                  <span className="font-title-sm text-title-sm text-text-ivory">{option.label}</span>
                  <span className="font-caption text-caption text-text-muted">{option.gloss}</span>
                </div>
              </div>
              <Icon name="radio_button_unchecked" className="text-text-muted group-hover:text-primary text-[20px] transition-colors" />
            </button>
          ))}
        </div>

        <div className="bg-secondary-container/40 p-space-md text-on-surface flex flex-col gap-2 rounded-xl shadow-[0_0_24px_rgba(82,58,138,0.2)]">
          <div className="flex items-center justify-between">
            <div className="text-secondary flex items-center gap-1.5">
              <Icon name="psychology" className="text-[20px]" />
              <span className="font-label-sm text-label-sm font-semibold tracking-wider uppercase">{t.player.archivistHint}</span>
            </div>
            <span className="bg-surface font-caption text-caption text-secondary-fixed-dim rounded-full px-2 py-0.5 font-medium">
              {node.hint.topic}
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface leading-relaxed">
            <HintText text={node.hint.text} />
          </p>
        </div>

        <div className="gap-space-sm flex flex-col pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="from-primary-fixed-dim to-primary-container font-label-md text-label-md text-surface-container-lowest flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b font-bold tracking-wider uppercase shadow-[0_4px_16px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98]"
          >
            <span>{t.player.retry}</span>
            <Icon name="cached" className="text-[18px]" />
          </button>
          <button
            type="button"
            aria-expanded={showTranslation}
            onClick={() => setShowTranslation((v) => !v)}
            className="font-caption text-caption text-text-muted hover:text-text-ivory flex w-full items-center justify-center gap-1.5 py-2 transition-colors"
          >
            <Icon name="menu_book" className="text-[16px]" />
            <span>{showTranslation ? t.player.hideTranslation : t.player.showTranslation}</span>
          </button>
        </div>
      </div>
    </main>
  );
}

/** An option's picture: a clue's own illustration for evidence, else its icon. */
function OptionPicture({ option, size }: { option: QuestionNode["options"][number]; size: string }) {
  if (option.image) return <img alt="" className="h-full w-full object-cover" src={option.image} />;
  return <Icon name={option.icon} className={size} />;
}

/** Highlights «quoted» English words in a hint, as the approved screen does with «never». */
function HintText({ text }: { text: string }) {
  const parts = text.split(/(«[A-Za-z' -]+»)/);
  return parts.map((part, i) =>
    /^«[A-Za-z' -]+»$/.test(part) ? (
      <span key={i} className="text-primary decoration-primary/40 font-semibold underline underline-offset-4">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** A listening riddle's parchment: the line is heard, not read (a recording, else the device's voice). */
function ListenParchment({ text, audioId, t }: { text: string; audioId?: string; t: Dictionary }) {
  const { availability, state, play } = useLineAudio(text, useMediaLink(audioId));
  const supported = availability !== "none";
  return (
    <div className="mb-space-lg px-margin">
      <div className="p-space-lg relative flex flex-col items-center overflow-hidden rounded-xl bg-[#D9C49B] text-center text-[#231D15] shadow-[0_12px_32px_rgba(0,0,0,0.7)]">
        <div className="mb-1 text-xs whitespace-pre text-[#6E5A3A] opacity-70">✦ ✤ ✦</div>
        <button
          type="button"
          onClick={play}
          disabled={!supported}
          aria-busy={state === "loading" || undefined}
          aria-pressed={state === "playing" || state === "loading"}
          data-audio={availability}
          data-audio-state={state}
          data-action="listen"
          className="font-label-md text-label-md flex items-center gap-2 rounded-full bg-[#231D15] px-5 py-2.5 text-[#E8E1D5] shadow-md transition-transform active:scale-95 disabled:opacity-50"
        >
          <Icon name="volume_up" className={`text-[20px] ${state === "playing" || state === "loading" ? "animate-pulse" : ""}`} />
          <span>{t.player.listen}</span>
        </button>
        <p className="font-caption text-caption mt-2 text-[#534525]">{supported ? t.player.listenHint : t.player.listenNoVoice}</p>
      </div>
    </div>
  );
}
