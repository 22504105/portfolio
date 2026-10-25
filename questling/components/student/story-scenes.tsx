"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { fill, type Dictionary } from "@/lib/i18n";
import type { OptionIcon } from "@/lib/story/types";
import { PronounceButton } from "./pronounce-button";
import { LineAudioButton } from "./line-audio";
import { useMediaLink } from "@/lib/client/student";
import { BackHeader } from "./back-header";
import { Parchment, SceneImage, StoryHeading } from "./story-player";

// The scenes that are read rather than graded: narration, dialogue, a choice, a chapter's end and
// the campaign's ending. The design has no screen of their own, so (owner's rule: only the
// existing design) each is put together from the approved story player's parts: the heading, the
// scene picture, the parchment, the option cards, the reward card and the gold button.

export type Frame = { chapter: string; cefr: string; storyTitle: string; location: string; image: string };

type Common = { t: Dictionary; frame: Frame; backHref: string; profileHref: string; pending: boolean; error: boolean };

function Page({
  t,
  frame,
  backHref,
  profileHref,
  kind,
  children,
}: Omit<Common, "pending" | "error"> & { kind: string; children: React.ReactNode }) {
  return (
    <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased" data-scene={kind}>
      <BackHeader title={t.player.title} backHref={backHref} profileHref={profileHref} t={t} />
      <main className="bg-background pb-safe mx-auto w-full max-w-[420px] flex-1 pt-16">
        <div className="flex w-full flex-col">
          <StoryHeading chapter={frame.chapter} cefr={frame.cefr} title={frame.storyTitle} />
          <SceneImage image={frame.image} location={frame.location} />
          {children}
        </div>
      </main>
    </div>
  );
}

function GoldButton({
  label,
  onClick,
  disabled,
  busy,
  action,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  action: string;
}) {
  return (
    <button
      type="button"
      data-action={action}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className="font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e4c285] to-[#b99a61] font-semibold tracking-wider text-[#271900] uppercase shadow-[0_6px_20px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span>{label}</span>
      <Icon name="arrow_forward" className="text-[20px]" />
    </button>
  );
}

function Failed({ t, error }: { t: Dictionary; error: boolean }) {
  return error ? (
    <p role="alert" className="mt-space-sm font-caption text-caption text-status-error text-center">
      {t.common.actionFailed}
    </p>
  ) : null;
}

function TranslationToggle({ t, open, onToggle }: { t: Dictionary; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="font-caption text-caption text-text-muted hover:text-text-ivory flex w-full items-center justify-center gap-1.5 py-2 transition-colors"
    >
      <Icon name="menu_book" className="text-[16px]" />
      <span>{open ? t.player.hideTranslation : t.player.showTranslation}</span>
    </button>
  );
}

/** The reward card of the correct-answer screen (05_story_player_50_xp), for any reward. */
export function StoryReward({ label, title, text, xp, coins }: { label: string; title: string; text: string; xp: number; coins?: number }) {
  return (
    <div className="mb-space-lg px-margin">
      <div
        role="status"
        className="border-primary/30 from-surface-container-high to-surface-container p-space-md relative overflow-hidden rounded-xl border bg-gradient-to-br shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
      >
        <div className="bg-primary/10 pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-xl"></div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-primary text-[10px]">✦</span>
            <span className="font-label-sm text-label-sm text-primary font-semibold tracking-widest uppercase">{label}</span>
            <span className="text-primary text-[10px]">✦</span>
          </div>
          <div className="flex items-center gap-1.5">
            {xp ? (
              <div className="border-status-success/40 bg-status-success/20 flex items-center gap-1 rounded-full border px-2.5 py-0.5">
                <Icon name="stars" filled className="text-status-success text-[14px]" />
                <span className="font-label-md text-label-md text-status-success font-bold">+{xp} XP</span>
              </div>
            ) : null}
            {coins ? (
              <div className="bg-surface-container-highest flex items-center gap-1 rounded-full px-2.5 py-0.5">
                <span className="text-[13px]">🪙</span>
                <span className="font-label-md text-label-md text-text-ivory font-bold">+{coins}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="gap-space-sm mt-1 flex items-start">
          <div className="border-primary/40 text-primary mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border bg-[#b99a61]/20">
            <Icon name="menu_book" className="text-[20px]" />
          </div>
          <div className="flex flex-col">
            <span className="font-title-sm text-title-sm text-text-ivory">{title}</span>
            <p className="font-caption text-caption text-text-muted mt-0.5">{text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A teacher's recording of the whole scene, when there is one: the quick quests' listening button. */
function SceneRecording({ text, audioId, label }: { text: string; audioId?: string; label: string }) {
  const link = useMediaLink(audioId);
  if (!link) return null;
  return (
    <div className="px-margin mb-space-md">
      <LineAudioButton
        text={text}
        src={link}
        action="listen-scene"
        className="bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md flex h-11 w-full items-center justify-center gap-2 rounded-lg uppercase shadow-xs transition-colors active:scale-[0.98] disabled:opacity-50"
      >
        <Icon name="headphones" className="text-primary text-[18px]" />
        <span>{label}</span>
      </LineAudioButton>
    </div>
  );
}

export function NarrationScreen({
  text,
  translation,
  clue,
  audio,
  onNext,
  ...common
}: Common & { text: string; translation: string; clue: string | null; audio?: string; onNext: () => void }) {
  const { t, pending, error } = common;
  const [open, setOpen] = useState(false);
  return (
    <Page {...common} kind="narration">
      <Parchment text={text} />
      <SceneRecording text={text} audioId={audio} label={t.player.listen} />
      {open ? (
        <p className="px-margin mb-space-md font-body-md text-body-md text-on-surface-variant -mt-2 text-center">{translation}</p>
      ) : null}
      {clue ? (
        <StoryReward label={t.journal.unlocked} title={t.player.journalTitle} text={fill(t.player.journalText, { title: clue })} xp={0} />
      ) : null}
      <div className="px-margin pb-space-lg flex flex-col items-center">
        <GoldButton label={t.story.next} onClick={onNext} busy={pending} action="next" />
        <Failed t={t} error={error} />
        <TranslationToggle t={t} open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
    </Page>
  );
}

export function DialogueScreen({
  lines,
  clue,
  audio,
  onNext,
  ...common
}: Common & {
  lines: { speaker: string; text: string; translation: string }[];
  clue: string | null;
  audio?: string;
  onNext: () => void;
}) {
  const { t, pending, error } = common;
  const [open, setOpen] = useState(false);
  return (
    <Page {...common} kind="dialogue">
      <SceneRecording text={lines.map((l) => l.text).join(" ")} audioId={audio} label={t.player.listenDialogue} />
      <div className="mb-space-lg gap-space-sm px-margin flex flex-col">
        {lines.map((line, i) => (
          <div key={i} className="bg-surface-container px-space-md py-space-sm relative flex w-full flex-col gap-1 rounded-xl shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="font-caption text-caption text-primary font-semibold tracking-wider uppercase">✦ {line.speaker}</span>
              <PronounceButton word={line.text} label={fill(t.player.listenLine, { speaker: line.speaker })} />
            </div>
            <p className="font-georgia text-title-sm text-text-ivory leading-snug italic">“{line.text}”</p>
            {open ? <p className="font-caption text-caption text-text-muted">{line.translation}</p> : null}
          </div>
        ))}
      </div>
      {clue ? (
        <StoryReward label={t.journal.unlocked} title={t.player.journalTitle} text={fill(t.player.journalText, { title: clue })} xp={0} />
      ) : null}
      <div className="px-margin pb-space-lg flex flex-col items-center">
        <GoldButton label={t.story.next} onClick={onNext} busy={pending} action="next" />
        <Failed t={t} error={error} />
        <TranslationToggle t={t} open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
    </Page>
  );
}

export function ChoiceScreen({
  text,
  translation,
  prompt,
  options,
  onChoose,
  ...common
}: Common & {
  text: string;
  translation: string;
  prompt: string;
  options: { id: string; label: string; gloss: string; icon: OptionIcon }[];
  onChoose: (option: string) => void;
}) {
  const { t, pending, error } = common;
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <Page {...common} kind="choice">
      <Parchment text={text} />
      {open ? (
        <p className="px-margin mb-space-md font-body-md text-body-md text-on-surface-variant -mt-2 text-center">{translation}</p>
      ) : null}
      <div className="mb-space-sm px-margin text-center">
        <p className="font-body-md text-body-md text-text-ivory leading-relaxed">{prompt}</p>
      </div>
      <div className="mb-space-xl gap-space-sm px-margin flex flex-col" role="radiogroup" aria-label={t.story.yourChoice}>
        {options.map((option) => {
          const chosen = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              data-option={option.id}
              onClick={() => setSelected(option.id)}
              className={`group bg-surface-container px-space-md py-space-sm relative flex min-h-[58px] w-full items-center justify-between rounded-xl transition-all duration-200 ${
                chosen ? "shadow-[0_0_18px_rgba(228,194,133,0.18)]" : "opacity-90 hover:opacity-100"
              }`}
            >
              <div className="gap-space-md flex items-center">
                <div
                  className={`group-hover:text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    chosen ? "bg-surface-container-high text-primary" : "bg-surface-container-low text-text-muted"
                  }`}
                >
                  <Icon name={option.icon} className="text-[22px]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-title-sm text-title-sm text-text-ivory tracking-wide">{option.label}</span>
                  <span className="font-caption text-caption text-text-muted">{option.gloss}</span>
                </div>
              </div>
              <div className="bg-surface-container-highest flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                <div className={`h-3 w-3 rounded-full ${chosen ? "bg-primary shadow-[0_0_8px_#e4c285]" : "bg-transparent"}`}></div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-margin pb-space-lg flex flex-col items-center">
        <GoldButton
          label={t.story.choose}
          onClick={() => selected && onChoose(selected)}
          disabled={!selected}
          busy={pending}
          action="choose"
        />
        <Failed t={t} error={error} />
        <TranslationToggle t={t} open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
    </Page>
  );
}

export function ChapterDoneScreen({
  title,
  reward,
  onNext,
  ...common
}: Omit<Common, "pending" | "error"> & { title: string; reward: { xp: number; coins: number }; onNext: () => void }) {
  const { t } = common;
  return (
    <Page {...common} kind="chapter-done">
      <div className="mb-space-md px-margin text-center">
        <span className="font-label-sm text-label-sm text-status-success flex items-center justify-center gap-1 font-semibold tracking-widest uppercase">
          <Icon name="verified" className="text-[16px]" /> {t.story.chapterDone}
        </span>
        <h2 className="font-headline-lg text-headline-lg text-text-ivory mt-1 leading-tight">{title}</h2>
      </div>
      <StoryReward label={t.story.chapterReward} title={title} text={t.details.firstTime} xp={reward.xp} coins={reward.coins} />
      <div className="px-margin pb-space-lg flex flex-col items-center">
        <GoldButton label={t.story.nextChapter} onClick={onNext} action="next" />
      </div>
    </Page>
  );
}

export function EndingScreen({
  title,
  tone,
  text,
  translation,
  endings,
  reward,
  campaign,
  nextCampaign,
  links,
  ...common
}: Omit<Common, "pending" | "error"> & {
  title: string;
  tone: "bright" | "bittersweet" | "secret";
  text: string;
  translation: string;
  endings: number;
  reward: { xp: number; coins: number };
  campaign: string;
  nextCampaign: string | null;
  links: { journal: string; map: string; play: string };
}) {
  const { t } = common;
  const [open, setOpen] = useState(false);
  return (
    <Page {...common} kind="ending">
      <div className="mb-space-md px-margin text-center">
        <span className="bg-secondary-container/40 font-label-sm text-label-sm text-secondary inline-flex items-center gap-1 rounded-full px-3 py-0.5 font-semibold tracking-wider uppercase">
          <Icon name={tone === "secret" ? "auto_awesome" : "military_tech"} className="text-[14px]" /> {t.story.tones[tone]}
        </span>
        <h2 className="font-headline-lg text-headline-lg text-text-ivory mt-2 leading-tight">{title}</h2>
        <p className="font-caption text-caption text-text-muted mt-1">{fill(t.story.endingOf, { total: endings })}</p>
      </div>
      <Parchment text={text} />
      {open ? (
        <p className="px-margin mb-space-md font-body-md text-body-md text-on-surface-variant -mt-2 text-center">{translation}</p>
      ) : null}
      <StoryReward
        label={t.story.endingReward}
        title={fill(t.story.campaignDone, { name: campaign })}
        text={nextCampaign ? fill(t.story.nextCampaign, { name: nextCampaign }) : t.details.firstTime}
        xp={reward.xp}
        coins={reward.coins}
      />
      <div className="px-margin pb-space-lg gap-space-sm flex flex-col items-center">
        {nextCampaign ? (
          <Link
            href={links.play}
            data-action="next-campaign"
            className="font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e4c285] to-[#b99a61] font-semibold tracking-wider text-[#271900] uppercase shadow-[0_6px_20px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98]"
          >
            <span>{t.story.toNextCampaign}</span>
            <Icon name="arrow_forward" className="text-[20px]" />
          </Link>
        ) : null}
        <Link
          href={links.journal}
          className={
            nextCampaign
              ? "bg-surface-container-high text-text-ivory hover:text-primary font-label-md text-label-md flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold transition-colors active:scale-[0.98]"
              : "font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e4c285] to-[#b99a61] font-semibold tracking-wider text-[#271900] uppercase shadow-[0_6px_20px_rgba(185,154,97,0.35)] transition-transform active:scale-[0.98]"
          }
        >
          <Icon name="menu_book" className="text-[18px]" />
          <span>{t.details.openJournal}</span>
        </Link>
        <Link
          href={links.map}
          className="font-caption text-caption text-text-muted hover:text-text-ivory flex w-full items-center justify-center gap-1.5 py-2 transition-colors"
        >
          <Icon name="map" className="text-[16px]" />
          <span>{t.player.backToMap}</span>
        </Link>
        <TranslationToggle t={t} open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
    </Page>
  );
}
