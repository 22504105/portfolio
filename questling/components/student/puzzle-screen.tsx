"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useStudent } from "@/lib/client/student";
import { fill, type Dictionary } from "@/lib/i18n";
import type { PuzzleNode } from "@/lib/story/types";
import { ExhaustedView, GrimoireSheet } from "./story-help";
import type { Help } from "./story-player";
import { TileBoard } from "./tile-board";

// A story cipher, ported from design-source/questling-v2/01_APPROVED_SCREENS/06_interactive_puzzle/code.html:
// the attempts crystals, the chest picture, the slots and tiles, the free hint, the feedback
// banner and the two buttons, with the export's own messages. Graded by the store (the server
// for a signed-in student). With no attempts left it pauses like a question does: the exhausted
// screen and the grimoire (story-help.tsx). Owner's decision 2026-10-24: the header names the screen.
// Tailwind v3 → v4: shadow → shadow-sm.

type Feedback = { tone: "success" | "error"; icon: "check_circle" | "warning" | "lock" | "lock_clock"; title: string; text: string };

type Props = {
  node: PuzzleNode;
  /** Attempts the run has already used on this cipher. */
  attemptsUsed: number;
  /** Sends the order to the rules. */
  grade: (tiles: string[]) => Promise<{ correct: boolean; explanation: string }>;
  /** "Забрать сокровища": the story moves on. */
  onNext: () => void;
  help: Help;
};

export function PuzzleScreen({ node, attemptsUsed, grade, onNext, help }: Props) {
  const { t, base } = useStudent();
  const [slots, setSlots] = useState<(string | null)[]>(() => node.tiles.map(() => null));
  const [attempts, setAttempts] = useState(attemptsUsed);
  // Attempts allowed: the cipher's own, plus one for each grimoire studied while on screen.
  const [allowed, setAllowed] = useState(node.maxAttempts);
  const [grimoire, setGrimoire] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [solved, setSolved] = useState(false);
  const [pending, startTransition] = useTransition();
  const left = allowed - attempts;
  const locked = left <= 0 && !solved;

  function change(next: (string | null)[]) {
    setSlots(next);
    if (!solved) setFeedback(null);
  }

  function check() {
    if (slots.includes(null)) {
      setFeedback({ tone: "error", icon: "warning", title: t.puzzle.incompleteTitle, text: t.puzzle.incompleteText });
      return;
    }
    startTransition(async () => {
      let result: { correct: boolean; explanation: string };
      try {
        result = await grade(slots as string[]);
      } catch {
        setFeedback({ tone: "error", icon: "warning", title: t.common.actionFailed, text: "" });
        return;
      }
      if (result.correct) {
        setSolved(true);
        setFeedback({
          tone: "success",
          icon: "check_circle",
          title: t.puzzle.solvedTitle,
          text: `${result.explanation} (+${node.reward.xp} XP)`,
        });
        return;
      }
      const used = attempts + 1;
      setAttempts(used);
      setFeedback(
        used >= allowed
          ? { tone: "error", icon: "lock_clock", title: t.puzzle.lockedTitle, text: t.puzzle.lockedText }
          : { tone: "error", icon: "lock", title: t.puzzle.wrongTitle, text: fill(t.puzzle.wrongText, { n: allowed - used }) },
      );
    });
  }

  const header = <PuzzleHeader t={t} base={base} />;

  if (locked)
    return (
      <div className="bg-background text-text-ivory flex min-h-dvh flex-col" data-phase={grimoire ? "grimoire" : "exhausted"}>
        {header}
        <ExhaustedView
          t={t}
          node={node}
          attemptsUsed={attempts}
          tried={[]}
          group={help.group}
          asked={help.asked}
          reply={help.reply}
          onAsk={help.onAsk}
          onOpenGrimoire={() => setGrimoire(true)}
          mapHref={`${base}/map`}
        />
        {grimoire ? (
          <GrimoireSheet
            t={t}
            node={{ ...node, maxAttempts: allowed }}
            onStudy={help.onStudy}
            onClose={() => setGrimoire(false)}
            onApply={() => {
              setGrimoire(false);
              setAllowed(attempts + 1);
              setFeedback(null);
              setSlots(node.tiles.map(() => null));
            }}
          />
        ) : null}
      </div>
    );

  return (
    <div className="bg-background text-text-ivory flex min-h-dvh flex-col" data-phase={solved ? "correct" : "answering"}>
      {header}

      <main className="pb-safe px-gutter bg-background relative mx-auto flex w-full max-w-md flex-1 flex-col pt-16">
        <div className="flex w-full flex-col pb-8 select-none">
          <div className="bg-surface-container-low p-space-md mb-space-md relative w-full overflow-hidden rounded-xl shadow-xl">
            <div className="bg-secondary-container/20 pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl"></div>
            <div className="bg-primary-container/15 pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full blur-2xl"></div>
            <div className="mb-space-sm relative z-10 flex items-center justify-between">
              <div className="gap-space-xs flex items-center">
                <Icon name="lock_open" className="text-primary text-[18px]" />
                <span className="font-label-sm text-label-sm text-text-muted tracking-wider uppercase">{node.title}</span>
              </div>
              <div className="gap-space-xs bg-surface-container-highest/80 px-space-sm flex items-center rounded-full py-1 shadow-inner">
                <span className="font-caption text-caption text-text-ivory mr-1">
                  {fill(t.player.attempt, { used: Math.min(attempts + 1, allowed), max: allowed })}
                </span>
                {Array.from({ length: allowed }, (_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 w-2.5 rotate-45 rounded-[1px] transition-all duration-300 ${
                      i < left ? "bg-secondary shadow-[0_0_8px_rgba(208,188,255,0.8)]" : "bg-surface-variant opacity-30"
                    }`}
                  ></div>
                ))}
              </div>
            </div>
            <div className="relative z-10">
              <p className="font-body-md text-body-md text-text-ivory leading-relaxed">{node.task}</p>
            </div>
          </div>

          <div className="mb-space-md bg-surface relative h-32 w-full overflow-hidden rounded-xl shadow-lg">
            <img alt="" className="h-full w-full object-cover opacity-60" src={node.image} />
            <div className="from-surface via-surface/40 absolute inset-0 bg-gradient-to-t to-transparent"></div>
            <div className="text-tertiary absolute right-3 bottom-2 left-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name="auto_stories" className="text-primary text-[16px]" />
                <span className="font-caption text-caption tracking-widest uppercase">{node.scroll}</span>
              </div>
              <span className="font-caption text-caption text-text-muted">{node.altar}</span>
            </div>
          </div>

          <TileBoard t={t} tiles={node.tiles} slots={slots} onChange={change} disabled={solved || locked || pending} />

          <div className="bg-surface mb-space-md w-full overflow-hidden rounded-xl shadow-sm transition-all duration-300">
            <button
              type="button"
              aria-expanded={hintOpen}
              onClick={() => setHintOpen((open) => !open)}
              className="px-space-md active:bg-surface-container-high flex w-full items-center justify-between py-3 text-left"
            >
              <div className="gap-space-xs text-secondary flex items-center">
                <Icon name="lightbulb" className="text-[20px]" />
                <span className="font-label-md text-label-md font-semibold">{t.puzzle.hint}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-caption text-caption text-text-muted bg-surface-container-highest rounded-full px-2 py-0.5">
                  {t.puzzle.free}
                </span>
                <Icon
                  name="expand_more"
                  className={`text-text-muted text-[20px] transition-transform duration-200 ${hintOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {hintOpen ? (
              <div className="px-space-md pb-space-md bg-surface-container-lowest/50 pt-1">
                <div className="p-space-sm bg-tertiary/10 gap-space-xs flex items-start rounded-lg">
                  <Icon name="menu_book" className="text-tertiary mt-0.5 shrink-0 text-[18px]" />
                  <p className="font-body-md text-body-md text-tertiary leading-snug">«{node.hint}»</p>
                </div>
              </div>
            ) : null}
          </div>

          {feedback ? (
            <div
              role={feedback.tone === "success" ? "status" : "alert"}
              className={`p-space-md mb-space-md text-text-ivory w-full rounded-xl shadow-lg transition-all duration-300 ${feedback.tone === "success" ? "bg-[#152e25]" : "bg-[#331619]"}`}
            >
              <div className="gap-space-sm flex items-center">
                <Icon
                  name={feedback.icon}
                  className={`text-[28px] ${feedback.tone === "success" ? "text-status-success" : "text-status-error"}`}
                />
                <div className="flex flex-col">
                  <h4
                    className={`font-headline-md text-title-sm ${feedback.tone === "success" ? "text-status-success" : "text-status-error"}`}
                  >
                    {feedback.title}
                  </h4>
                  {feedback.text ? <p className="font-body-md text-body-md">{feedback.text}</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="gap-space-sm mt-auto flex w-full flex-col">
            {solved ? (
              <button
                type="button"
                data-action="next"
                onClick={onNext}
                className="font-headline-md text-surface-container-lowest flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#63BA9E] to-[#458e77] text-[18px] font-semibold tracking-wider uppercase shadow-[0_0_16px_rgba(185,154,97,0.25)] transition-all active:scale-[0.98]"
              >
                <span>{t.puzzle.collect}</span>
                <Icon name="arrow_forward" className="text-[20px]" />
              </button>
            ) : (
              <button
                type="button"
                data-action="check"
                onClick={check}
                disabled={locked || pending}
                aria-busy={pending}
                className="font-headline-md flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#D5B87E] to-[#B99A61] text-[18px] font-semibold tracking-wider text-[#101016] uppercase shadow-[0_0_16px_rgba(185,154,97,0.25)] transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <span>{t.puzzle.check}</span>
                <Icon name="arrow_forward" className="text-[20px]" />
              </button>
            )}
            <button
              type="button"
              onClick={() => change(node.tiles.map(() => null))}
              disabled={solved}
              className="bg-surface-container-high text-text-muted hover:text-text-ivory font-label-md text-label-md flex h-11 w-full items-center justify-center gap-1.5 rounded-lg transition-all active:scale-[0.98] disabled:opacity-40"
            >
              <Icon name="restart_alt" className="text-[18px]" />
              <span>{t.puzzle.reset}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function PuzzleHeader({ t, base }: { t: Dictionary; base: string }) {
  return (
    <header className="bg-surface/90 pt-safe fixed inset-x-0 top-(--demo-bar) z-50 shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      <div className="px-gutter mx-auto flex h-16 w-full max-w-md items-center justify-between">
        <div className="gap-space-xs flex items-center">
          <Link
            href={`${base}/map`}
            aria-label={t.common.back}
            className="text-primary flex h-11 w-11 items-center justify-center transition-transform active:scale-95"
          >
            <Icon name="arrow_back" className="text-[24px]" />
          </Link>
          <h1 className="font-headline-md text-headline-md text-text-ivory line-clamp-1 tracking-tight">{t.puzzle.title}</h1>
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
  );
}
