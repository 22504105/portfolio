"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { useStudent } from "@/lib/client/student";
import { fill } from "@/lib/i18n";
import { segments, type GlossView } from "@/lib/learning/gloss";
import { PronounceButton } from "./pronounce-button";

// English text with word help: the marked words are underlined and open their translation in a
// sheet from the bottom (the grimoire sheet's frame, 05_story_player_never_2). The text itself
// stays on screen. Without marks the text is rendered exactly as before.

export function GlossedText({ text, glosses }: { text: string; glosses?: GlossView[] }) {
  const [open, setOpen] = useState<GlossView | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  if (!glosses?.length) return <>{text}</>;
  return (
    <>
      {segments(text, glosses).map((part, i) =>
        part.gloss ? (
          <GlossWord
            key={i}
            gloss={part.gloss}
            onOpen={(button) => {
              opener.current = button;
              setOpen(part.gloss!);
            }}
          />
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
      {open ? (
        <GlossSheet
          gloss={open}
          onClose={() => {
            setOpen(null);
            opener.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

function GlossWord({ gloss, onOpen }: { gloss: GlossView; onOpen: (button: HTMLButtonElement) => void }) {
  const { t } = useStudent();
  return (
    <button
      type="button"
      data-gloss={gloss.id}
      aria-haspopup="dialog"
      aria-label={fill(t.gloss.open, { phrase: gloss.phrase })}
      onClick={(e) => onOpen(e.currentTarget)}
      className="decoration-primary/80 hover:decoration-primary cursor-help rounded-xs underline decoration-dotted decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {gloss.phrase}
    </button>
  );
}

function GlossSheet({ gloss, onClose }: { gloss: GlossView; onClose: () => void }) {
  const { t } = useStudent();
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // On the page body: the parchment around the word clips and styles its contents.
  return createPortal(
    <span
      className="fixed inset-0 z-[70] flex flex-col items-center justify-end bg-black/60 backdrop-blur-xs sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-gloss-sheet={gloss.id}
    >
      <span
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pb-safe relative flex w-full max-w-[420px] flex-col gap-3 rounded-t-2xl border-t-2 border-[#B99A61]/70 bg-[#191724] px-5 pt-3 text-left not-italic shadow-[0_-10px_35px_rgba(0,0,0,0.85)] sm:rounded-2xl sm:border-2"
      >
        <span className="flex justify-center">
          <span className="bg-border-antique/50 h-1 w-12 rounded-full"></span>
        </span>
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span id={titleId} lang="en" className="font-title-sm text-title-sm text-text-ivory truncate">
              {gloss.phrase}
            </span>
            <PronounceButton word={gloss.phrase} label={fill(t.gloss.listen, { phrase: gloss.phrase })} />
            {gloss.cefr ? (
              <span className="bg-secondary-container/40 text-secondary-fixed font-label-sm rounded-full px-2 py-0.5 text-[10px] tracking-wider">
                {gloss.cefr}
              </span>
            ) : null}
          </span>
          <button
            ref={close}
            type="button"
            aria-label={t.gloss.close}
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a2930]/80 text-[#AFA8B7] transition-colors hover:bg-[#35343b] hover:text-[#E8E1D5]"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase">{t.gloss.translation}</span>
          <span lang="ru" className="font-body-md text-body-md text-text-ivory">
            {gloss.ru}
          </span>
        </span>
        {gloss.definition ? (
          <span className="flex flex-col gap-0.5">
            <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase">{t.gloss.definition}</span>
            <span lang="en" className="font-body-md text-body-md text-on-surface-variant">
              {gloss.definition}
            </span>
          </span>
        ) : null}
        {gloss.example ? (
          <span className="bg-surface-container-lowest/60 rounded-sm p-2.5">
            <span className="font-label-sm text-label-sm text-text-muted block">{t.gloss.example}</span>
            <span lang="en" className="font-title-sm text-title-sm text-text-ivory italic">
              “{gloss.example}”
            </span>
          </span>
        ) : null}
        {gloss.note ? (
          <span className="flex gap-2 pb-1">
            <Icon name="lightbulb" className="text-primary text-[18px]" />
            <span className="font-body-md text-body-md text-on-surface-variant">{gloss.note}</span>
          </span>
        ) : null}
        <span className="pb-4"></span>
      </span>
    </span>,
    document.body,
  );
}
