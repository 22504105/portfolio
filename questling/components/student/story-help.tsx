"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { fill, type Dictionary } from "@/lib/i18n";
import type { StoryNode } from "@/lib/story/types";

// What a stuck student sees, for a question, a piece of evidence or a cipher alike:
//   ExhaustedView — 02_STORY_STATES/05_story_player_4: no attempts left, the quest paused,
//                   two ways on: ask the mentor, or study the grimoire.
//   GrimoireSheet — 02_STORY_STATES/05_story_player_never_2: the rule, the deduction, a one-word
//                   quiz; the right word wins back one attempt (the rules check it, lib/story/run.ts).
// Deviations, all for honesty (docs/visual-qa/README.md): the mentor card says the request is
// kept for Teacher Studio instead of promising a Telegram reply now, and shows the student's group
// instead of a made-up "В сети"; the toast says the request was saved, not delivered. The riddle's
// key word is not highlighted in the grimoire: that word is the quiz's answer.
// The "Вернуться в Библиотеку историй" button leads to the story map, the hub of the stories.

type ExhaustedProps = {
  t: Dictionary;
  node: StoryNode;
  attemptsUsed: number;
  /** The wrong answers tried, as shown (empty for a cipher). */
  tried: string[];
  /** The student's group, if they have one: whose mentor is asked. */
  group: string | null;
  asked: boolean;
  onAsk: () => Promise<boolean>;
  onOpenGrimoire: () => void;
  mapHref: string;
};

export function ExhaustedView({ t, node, attemptsUsed, tried, group, asked, onAsk, onOpenGrimoire, mapHref }: ExhaustedProps) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState(false);
  const [failed, setFailed] = useState(false);

  // The paused scene opens at its top, wherever the answer was given from.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  function ask() {
    if (asked || pending) return;
    setFailed(false);
    startTransition(async () => {
      if (await onAsk()) setToast(true);
      else setFailed(true);
    });
  }

  const steps = Array.from({ length: node.clue.total }, (_, i) => i + 1);
  const triedText = tried.map((label) => `«${label}»`);

  return (
    <main className="bg-background pb-safe mx-auto w-full max-w-[420px] flex-1 pt-16">
      <div className="text-on-surface flex w-full flex-col pb-8">
        <div className="px-margin flex items-center justify-between pt-2 pb-3">
          <div className="gap-space-xs flex min-w-0 items-center">
            <span className="text-primary text-label-sm font-label-sm shrink-0 font-semibold tracking-widest uppercase">
              ✦ {node.chapter} ✦
            </span>
            <span className="text-outline-variant text-[10px]">•</span>
            <span className="text-text-muted text-label-sm font-label-sm truncate">{node.location}</span>
          </div>
          <span className="bg-secondary-container/60 text-secondary text-caption font-label-sm shrink-0 rounded-full px-2 py-0.5 font-semibold tracking-wider uppercase">
            CEFR {node.cefr}
          </span>
        </div>

        <div className="px-margin mb-3">
          <h2 className="font-headline-lg text-headline-lg text-text-ivory leading-tight">{node.storyTitle}</h2>
          <p className="font-body-md text-body-md text-text-muted mt-0.5">{t.player.mode}</p>
        </div>

        <div className="px-margin mb-4">
          <div className="bg-surface-container-high relative h-44 w-full overflow-hidden rounded-xl shadow-xl">
            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url('${node.image}')` }}></div>
            <div className="from-surface via-surface/40 absolute inset-0 bg-gradient-to-t to-transparent"></div>
            <div className="to-surface-dim/80 absolute inset-0 bg-radial from-transparent"></div>
            <div className="bg-surface-dim/90 absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-md backdrop-blur-md">
              <Icon name="temple_hindu" className="text-primary text-[15px]" />
              <span className="text-text-ivory text-caption font-label-sm tracking-wide">{node.location}</span>
            </div>
            <div className="bg-surface/95 absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 shadow-lg backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-2">
                <Icon name="lock_clock" filled className="text-status-error shrink-0 text-[20px]" />
                <span className="text-text-ivory text-label-sm font-label-sm font-semibold">
                  {fill(t.story.attemptsOut, { used: attemptsUsed, max: node.maxAttempts })}
                </span>
              </div>
              <span className="text-status-error text-caption font-label-sm bg-error-container/40 rounded px-2 py-0.5 font-semibold tracking-wider uppercase">
                {t.story.paused}
              </span>
            </div>
          </div>
        </div>

        <div className="px-margin mb-4">
          <div className="bg-surface flex flex-col gap-2.5 rounded-xl p-3 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-primary font-label-sm text-[13px] font-semibold tracking-wider uppercase">
                ✦ {fill(t.player.clueOf, { n: node.clue.index, total: node.clue.total })} ✦
              </span>
              <span className="text-caption font-label-sm text-text-muted text-right">{t.story.trailLost}</span>
            </div>
            <div className="grid items-center gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
              {steps.map((step) =>
                step < node.clue.index ? (
                  <div key={step} className="flex flex-col items-center gap-1">
                    <div className="bg-status-success h-1.5 w-full rounded-full shadow-[0_0_8px_rgba(99,186,158,0.4)]"></div>
                    <Icon name="check_circle" className="text-status-success text-[14px]" />
                  </div>
                ) : step === node.clue.index ? (
                  <div key={step} className="flex flex-col items-center gap-1">
                    <div className="bg-status-error h-1.5 w-full rounded-full shadow-[0_0_8px_rgba(232,132,132,0.4)]"></div>
                    <Icon name="lock" filled className="text-status-error text-[14px]" />
                  </div>
                ) : (
                  <div key={step} className="flex flex-col items-center gap-1 opacity-40">
                    <div className="bg-surface-container-highest h-1.5 w-full rounded-full"></div>
                    <Icon name="radio_button_unchecked" className="text-text-muted text-[14px]" />
                  </div>
                ),
              )}
            </div>
            <p className="font-caption text-caption text-text-muted pt-0.5 text-center">{t.story.trailText}</p>
          </div>
        </div>

        <div className="px-margin mb-4 flex flex-col gap-3">
          <div className="bg-tertiary-fixed-dim text-on-tertiary-fixed relative overflow-hidden rounded-xl p-4 shadow-xl">
            <div className="text-on-tertiary-fixed-variant mb-1 flex items-center justify-between text-[12px] opacity-70">
              <span>✦ ✦ ✦</span>
              <span className="text-caption font-label-sm text-center font-semibold tracking-widest uppercase">{t.story.fragment}</span>
              <span>✦ ✦ ✦</span>
            </div>
            <blockquote className="font-headline-md text-headline-md text-on-tertiary-fixed my-2 text-center leading-snug italic">
              “{node.clue.text}”
            </blockquote>
            {node.translation ? (
              <div className="text-on-tertiary-container/80 text-caption font-body-md flex items-center justify-center gap-2 pt-1 text-center">
                <Icon name="menu_book" className="shrink-0 text-[16px]" />
                <span>{fill(t.story.translation, { text: node.translation })}</span>
              </div>
            ) : null}
          </div>

          <div className="bg-surface-container-low flex items-start gap-3 rounded-xl p-3.5 shadow-md">
            <div className="bg-error-container/30 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <Icon name="psychology_alt" className="text-error text-[20px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-title-sm text-title-sm text-text-ivory leading-snug">{t.story.unsolvedTitle}</h3>
              <p className="font-body-md text-body-md text-text-muted mt-1 leading-relaxed">
                {triedText.length ? (
                  <TriedText template={t.story.unsolvedTried} tried={triedText} and={t.story.and} />
                ) : (
                  t.story.unsolvedPlain
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="px-margin mb-5 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="font-label-md text-label-md text-primary font-semibold tracking-wide uppercase">{t.story.paths}</span>
            <span className="text-caption font-caption text-text-muted">{t.story.pathsHint}</span>
          </div>

          <button
            type="button"
            data-action="ask-mentor"
            onClick={ask}
            disabled={asked || pending}
            className="group bg-surface relative overflow-hidden rounded-xl p-3.5 text-left shadow-lg transition-transform active:scale-[0.99] disabled:active:scale-100"
          >
            <div className="flex items-start gap-3.5">
              <div className="bg-secondary-container/50 relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md">
                <Icon name="school" className="text-secondary text-[28px]" />
                {group ? (
                  <span className="bg-status-success text-surface-dim absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                    ✓
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-title-sm text-title-sm text-text-ivory mb-1 truncate font-semibold">{t.story.askTitle}</h4>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="bg-primary/20 text-primary text-caption font-label-sm inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
                    <Icon name="send" className="text-[12px]" />
                    {t.story.mentorChip}
                  </span>
                  <span className="text-caption font-caption text-text-muted">{group ?? t.story.noGroup}</span>
                </div>
                <p className="font-body-md text-body-md text-text-muted leading-relaxed">{t.story.mentorText}</p>
              </div>
            </div>
            <div className="text-primary text-label-sm font-label-sm mt-3 flex items-center justify-between pt-2.5 font-semibold">
              <span className="flex items-center gap-1.5">
                <Icon name={asked ? "check_circle" : "bolt"} className="text-[16px]" />
                <span>{asked ? t.story.asked : t.story.mentorAction}</span>
              </span>
              <Icon name="arrow_forward" className="text-[18px]" />
            </div>
          </button>

          <button
            type="button"
            data-action="open-grimoire"
            onClick={onOpenGrimoire}
            className="group bg-surface relative overflow-hidden rounded-xl p-3.5 text-left shadow-lg transition-transform active:scale-[0.99]"
          >
            <div className="flex items-start gap-3.5">
              <div className="bg-surface-container-high relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-md">
                <img alt="" className="h-full w-full object-cover" src="/images/rune-spellbook.webp" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-title-sm text-title-sm text-text-ivory mb-1 line-clamp-2 font-semibold">{node.grimoire.title}</h4>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="bg-secondary-container/40 text-secondary text-caption font-label-sm inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
                    <Icon name="auto_stories" className="text-[12px]" />
                    {t.story.grimoireChip}
                  </span>
                  <span className="text-caption font-caption text-text-muted">
                    {fill(t.story.readMinutes, { n: node.grimoire.minutes })}
                  </span>
                </div>
                <p className="font-body-md text-body-md text-text-muted leading-relaxed">
                  {fill(t.story.grimoireText, { heading: node.grimoire.heading })}
                </p>
              </div>
            </div>
            <div className="text-secondary text-label-sm font-label-sm mt-3 flex items-center justify-between pt-2.5 font-semibold">
              <span className="flex items-center gap-1.5">
                <Icon name="menu_book" className="text-[16px]" />
                <span>{t.story.grimoireAction}</span>
              </span>
              <Icon name="arrow_forward" className="text-[18px]" />
            </div>
          </button>
        </div>

        <div className="px-margin flex flex-col gap-2.5">
          <button
            type="button"
            onClick={ask}
            disabled={asked || pending}
            aria-busy={pending}
            className="from-primary via-primary-container to-primary text-on-primary font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r font-semibold tracking-wider uppercase shadow-[0_0_16px_rgba(185,154,97,0.3)] transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <Icon name={asked ? "mark_chat_read" : "mark_chat_unread"} className="text-[20px]" />
            <span>{asked ? t.story.asked : t.story.askButton}</span>
          </button>
          {failed ? (
            <p role="alert" className="font-caption text-caption text-status-error text-center">
              {t.common.actionFailed}
            </p>
          ) : null}
          <Link
            href={mapHref}
            className="bg-surface-container-high text-text-ivory hover:text-primary font-label-md text-label-md flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold transition-colors active:scale-[0.98]"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            <span>{t.player.backToMap}</span>
          </Link>
        </div>

        <div
          role="status"
          className={`bg-surface-container-highest/95 text-text-ivory fixed right-4 bottom-6 left-4 z-50 mx-auto flex max-w-[358px] items-center gap-3 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
            toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-32 opacity-0"
          }`}
        >
          <div className="bg-status-success/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Icon name="send" className="text-status-success text-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-label-sm text-label-sm text-text-ivory font-semibold">{toast ? t.story.toastTitle : ""}</p>
            <p className="font-caption text-caption text-text-muted truncate">{toast ? t.story.toastText : ""}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

/** "Вы проверили «A» и «B», …" with the tried answers in ivory, as the approved screen shows them. */
function TriedText({ template, tried, and }: { template: string; tried: string[]; and: string }) {
  const [before, after] = template.split("{tried}");
  return (
    <>
      {before}
      {tried.map((label, i) => (
        <span key={label}>
          {i > 0 ? (i === tried.length - 1 ? ` ${and} ` : ", ") : null}
          <span className="text-text-ivory font-medium">{label}</span>
        </span>
      ))}
      {after}
    </>
  );
}

type GrimoireProps = {
  t: Dictionary;
  node: StoryNode;
  /** Sends the word to the rules; true when it was the right one (an attempt is back). */
  onStudy: (word: string) => Promise<boolean>;
  onClose: () => void;
  /** After the right word: back to the riddle with the attempt won back. */
  onApply: () => void;
};

export function GrimoireSheet({ t, node, onStudy, onClose, onApply }: GrimoireProps) {
  const titleId = useId();
  const [word, setWord] = useState<string | null>(null);
  const [result, setResult] = useState<"right" | "wrong" | "failed" | null>(null);
  const [pending, startTransition] = useTransition();
  const sheet = useRef<HTMLDivElement>(null);
  const { grimoire } = node;
  const [before, after] = grimoire.quiz.sentence.split("___");
  // The rule's key words, bracketed in its formula: "Subject + [NEVER] + Verb".
  const keyWords = [...grimoire.formula.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);

  // Once the right word is in, the attempt is already back: closing the sheet returns to the riddle.
  const close = result === "right" ? onApply : onClose;

  useEffect(() => {
    sheet.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function pick(option: string) {
    if (pending || result === "right") return;
    setWord(option);
    startTransition(async () => {
      try {
        setResult((await onStudy(option)) ? "right" : "wrong");
      } catch {
        setResult("failed");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end overflow-y-auto bg-black/75 backdrop-blur-md sm:p-4"
      data-phase="grimoire"
    >
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-2xl border-t-2 border-[#B99A61]/70 bg-[#191724] shadow-[0_-10px_35px_rgba(0,0,0,0.85)] outline-none sm:rounded-2xl sm:border-2"
      >
        <div className="pointer-events-none absolute -top-12 left-1/2 h-24 w-64 -translate-x-1/2 rounded-full bg-[#8D75C9]/25 blur-3xl"></div>
        <div className="flex justify-center pt-3 pb-1">
          <div className="bg-border-antique/50 h-1 w-12 rounded-full"></div>
        </div>
        <div className="flex items-center justify-between border-b border-[#6E5A3A]/30 px-5 py-2">
          <div className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
            <span className="text-[10px]">✦</span>
            <span>{t.story.grimoireHeader}</span>
            <span className="text-[10px]">✦</span>
          </div>
          <button
            type="button"
            aria-label={t.story.closeGrimoire}
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2930]/80 text-[#AFA8B7] transition-colors hover:bg-[#35343b] hover:text-[#E8E1D5]"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="pb-safe flex flex-col gap-4 overflow-y-auto px-4 py-4 text-left [&>*]:shrink-0">
          <div className="flex items-center gap-3.5 rounded-xl border border-[#6E5A3A]/40 bg-[#201d2d] p-3 shadow-inner">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-[#B99A61] bg-[#131319] shadow-[0_0_12px_rgba(185,154,97,0.35)]">
              <img alt="" className="h-full w-full object-cover" src="/images/rune-spellbook.webp" />
            </div>
            <div className="flex min-w-0 flex-col">
              <h2 id={titleId} className="font-headline-lg text-[18px] leading-snug font-semibold text-[#E8E1D5]">
                {grimoire.title}
              </h2>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-[#AFA8B7]">
                <span className="rounded border border-[#8D75C9]/40 bg-[#523a8a]/70 px-1.5 py-0.5 text-[11px] font-medium text-[#d0bcff]">
                  {fill(t.story.scroll, { cefr: node.cefr })}
                </span>
                <span>•</span>
                <span className="text-primary flex items-center gap-0.5">
                  <Icon name="timer" className="text-[13px]" /> {fill(t.story.minutes, { n: grimoire.minutes })}
                </span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[#6E5A3A]/60 bg-[#262121] p-3.5 shadow-md">
            <div className="pointer-events-none absolute -right-4 -bottom-4 text-[#6E5A3A]/20 select-none">
              <Icon name="menu_book" className="text-[72px]" />
            </div>
            <div className="text-primary mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase">
              <Icon name="history_edu" className="text-[14px]" /> {t.story.riddleText}
            </div>
            <blockquote className="font-headline-lg my-1.5 text-[19px] leading-snug text-[#E8E1D5] italic">
              “<Marked text={node.clue.text} words={keyWords} />”
            </blockquote>
            {node.translation ? (
              <p className="mt-1 border-t border-[#6E5A3A]/30 pt-1.5 text-xs font-normal text-[#d0c5b5] italic">«{node.translation}»</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-[#35343b] bg-[#201d2d] p-3.5">
            <div>
              <div className="text-primary mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <Icon name="auto_stories" className="text-primary text-[16px]" />
                {grimoire.heading}
              </div>
              <div className="text-primary rounded-lg border border-[#6E5A3A]/50 bg-[#12111a] px-2.5 py-1.5 text-center text-[12px] font-semibold tracking-wide">
                {grimoire.formula.split(/(\[[^\]]+\])/).map((part, i) =>
                  part.startsWith("[") ? (
                    <span key={i} className="font-bold text-[#8D75C9] underline">
                      {part}
                    </span>
                  ) : (
                    part
                  ),
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#E8E1D5]/90">{grimoire.text}</p>
            </div>
            <div className="rounded-lg border border-[#8D75C9]/30 bg-[#161521] p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#d0bcff]">
                <Icon name="psychology_alt" className="text-[16px] text-[#8D75C9]" />
                {t.story.deduction}
              </div>
              <p className="text-xs leading-relaxed text-[#AFA8B7]">{grimoire.deduction}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-[#35343b] bg-[#201d2d] p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E8E1D5]">
              <Icon name="quiz" className="text-primary text-[16px]" />
              {t.story.practice}
            </div>
            <p className="font-headline-lg rounded-md border border-[#35343b]/60 bg-[#161521] py-1 text-center text-[14px] text-[#E8E1D5] italic">
              “{before}
              <span className="text-primary font-bold underline decoration-dashed">{result === "right" && word ? word : "____"}</span>
              {after}”
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1" role="group" aria-label={t.story.practice}>
              {grimoire.quiz.options.map((option) => {
                const chosen = option === word;
                const right = chosen && result === "right";
                const wrong = chosen && result === "wrong";
                return (
                  <button
                    key={option}
                    type="button"
                    data-word={option}
                    onClick={() => pick(option)}
                    disabled={pending || result === "right"}
                    aria-pressed={chosen}
                    className={`flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-center text-xs transition-colors ${
                      right
                        ? "border-status-success border-2 bg-[#523a8a]/70 font-semibold text-[#E8E1D5] shadow-sm"
                        : wrong
                          ? "border-status-error border-2 bg-[#2a2930] font-medium text-[#AFA8B7]"
                          : result === "right"
                            ? "bg-[#2a2930] font-medium text-[#AFA8B7] opacity-60"
                            : "bg-[#2a2930] font-medium text-[#E8E1D5] hover:bg-[#35343b]"
                    }`}
                  >
                    <span>{option}</span>
                    {right ? <Icon name="done" className="text-status-success text-[14px]" /> : null}
                  </button>
                );
              })}
            </div>
            {result === "wrong" || result === "failed" ? (
              <p role="alert" className="text-status-error text-center text-xs">
                {result === "wrong" ? t.story.wrongWord : t.common.actionFailed}
              </p>
            ) : null}
          </div>

          <div
            role="status"
            className={`flex items-center gap-3 rounded-xl border border-[#8D75C9]/50 bg-gradient-to-r from-[#201d2d] to-[#282236] p-3 shadow-md transition-opacity ${
              result === "right" ? "" : "opacity-60"
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#8D75C9]/60 bg-[#131319] p-1 shadow-[0_0_10px_rgba(141,117,201,0.3)]">
              <img alt="" className="h-full w-full object-contain" src="/images/crystal-casket.webp" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span
                className={`flex items-center gap-1 text-xs font-semibold ${result === "right" ? "text-status-success" : "text-[#AFA8B7]"}`}
              >
                <Icon name="auto_fix_high" className="text-[15px]" /> {result === "right" ? t.story.rewardDone : t.story.rewardPending}
              </span>
              <p className="text-xs leading-snug font-semibold text-[#E8E1D5]">
                {result === "right" ? t.story.attemptBack : t.story.attemptOffer}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              data-action="apply-grimoire"
              onClick={onApply}
              disabled={result !== "right"}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#ffdea5] bg-gradient-to-r from-[#B99A61] via-[#e4c285] to-[#B99A61] px-4 py-3.5 text-xs font-bold tracking-wider text-[#251a01] uppercase shadow-[0_4px_16px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <span>{t.story.apply}</span>
              <span className="text-sm font-bold">✦</span>
            </button>
            <button
              type="button"
              onClick={close}
              className="w-full py-2 text-center text-xs font-medium text-[#AFA8B7] transition-colors hover:text-[#E8E1D5]"
            >
              {t.story.closeGrimoire}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The text with the rule's key words marked, as the export marks «never» in the riddle. */
function Marked({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return text;
  const pattern = new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-bold text-[#8D75C9] underline decoration-[#8D75C9]/80 decoration-wavy underline-offset-4">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
