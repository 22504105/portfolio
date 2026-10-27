"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP; a teacher's picture comes by a signed link */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { tr } from "@/lib/content/text";
import { useStudent } from "@/lib/client/student";
import { fill } from "@/lib/i18n";
import type { GlossView } from "@/lib/learning/gloss";
import type { SearchScene, TalkScene } from "@/lib/story/graph";
import { holds, type RunState } from "@/lib/story/run";
import { worldOf } from "@/lib/game/world";
import { itemById } from "@/lib/content/items";
import { GlossedText } from "./glossed-text";
import { PronounceButton } from "./pronounce-button";
import { Failed, GoldButton, Page, StoryReward, TranslationToggle, type Common } from "./story-scenes";
import { spotAt } from "@/lib/story/spot";

// The story scenes of features gate E, put together from the player's approved parts only: the
// dialogue cards and choice rows (05), the scene picture and the reward card (05_story_player_50_xp).

/** A talk with a character: their line, and the student's English answers on offer. */
export function TalkScreen({
  scene,
  run,
  onSay,
  ...common
}: Common & { scene: TalkScene; run: RunState; onSay: (response: string) => void }) {
  const { t, locale } = useStudent();
  const { pending, error } = common;
  const [open, setOpen] = useState(false);
  const line = scene.lines.find((l) => l.id === (run.talk?.[scene.id] ?? scene.start)) ?? scene.lines[0];
  const offered = line.responses.filter((r) => !r.when || holds(r.when, run));
  const name = tr(scene.character.name, locale);
  return (
    <Page {...common} kind="talk">
      <div className="mb-space-lg gap-space-sm px-margin flex flex-col" data-talk-line={line.id}>
        <div className="bg-surface-container px-space-md py-space-sm relative flex w-full gap-3 rounded-xl shadow-md">
          <img src={scene.character.image} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-caption text-caption text-primary font-semibold tracking-wider uppercase">✦ {name}</span>
              <PronounceButton word={line.text} label={fill(t.player.listenLine, { speaker: name })} />
            </div>
            <p lang="en" className="font-georgia text-title-sm text-text-ivory leading-snug italic">
              “<GlossedText text={line.text} glosses={common.glosses?.filter((g) => g.field === `talk:${line.id}`)} />”
            </p>
            {open ? <p className="font-caption text-caption text-text-muted">{tr(line.translation, locale)}</p> : null}
          </div>
        </div>
        <TranslationToggle t={t} open={open} onToggle={() => setOpen(!open)} />
      </div>
      <div className="mb-space-sm px-margin text-center">
        <p className="font-body-md text-body-md text-text-ivory">{t.scenes.talkChoose}</p>
      </div>
      <div className="mb-space-xl gap-space-sm px-margin flex flex-col">
        {offered.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <button
              type="button"
              data-response={r.id}
              disabled={pending}
              onClick={() => onSay(r.id)}
              className="group bg-surface-container px-space-md py-space-sm hover:bg-surface-container-high flex min-h-[58px] flex-1 flex-col items-start rounded-xl text-left transition-colors disabled:opacity-60"
            >
              <span lang="en" className="font-title-sm text-title-sm text-text-ivory">
                {t.scenes.you}: “{r.text}”
              </span>
              <span className="font-caption text-caption text-text-muted">{tr(r.gloss, locale)}</span>
            </button>
            <PronounceButton word={r.text} label={fill(t.scenes.talkListen, { text: r.text })} />
          </div>
        ))}
      </div>
      <div className="px-margin pb-space-lg">
        <Failed t={t} error={error} />
      </div>
    </Page>
  );
}

type Tap = { spot: string; correct: boolean; done: boolean };

/**
 * Find the clue in a picture. Spots are fractions of the picture, so they hold at any width; every
 * spot is also a button in the list below (the accessible way, and a tap target always big enough).
 */
export function SearchScreen({
  scene,
  run,
  onTap,
  onNext,
  ...common
}: Common & { scene: SearchScene; run: RunState; onTap: (spot: string) => Promise<Tap | null>; onNext: () => void }) {
  const { t, locale, media } = useStudent();
  const { pending, error } = common;
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "bad" | "plain" } | null>(null);
  const [picture, setPicture] = useState<string | null>(scene.picture.startsWith("/") ? scene.picture : null);
  const box = useRef<HTMLDivElement>(null);
  const found = run.found?.[scene.id] ?? [];
  const solved = run.visited.includes(scene.id);
  const wrong = run.progress[scene.id]?.used ?? 0;
  const glossesFor = (field: string): GlossView[] => common.glosses?.filter((g) => g.field === field) ?? [];

  useEffect(() => {
    if (scene.picture.startsWith("/")) return;
    let live = true;
    void media.link(scene.picture).then((url) => live && setPicture(url));
    return () => {
      live = false;
    };
  }, [scene.picture, media]);

  const tap = async (spot: string) => {
    if (found.includes(spot) || solved) return;
    const result = await onTap(spot);
    if (!result) return;
    const s = scene.spots.find((x) => x.id === spot)!;
    setMessage(
      result.correct
        ? { text: tr(s.found, locale), tone: "ok" }
        : { text: `${t.scenes.wrong}: ${s.label} — ${tr(s.gloss, locale)}`, tone: "bad" },
    );
  };
  const onPicture = (e: React.MouseEvent) => {
    const rect = box.current!.getBoundingClientRect();
    const hit = spotAt(scene.spots, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    if (hit) void tap(hit.id);
    else setMessage({ text: t.scenes.nothing, tone: "plain" });
  };
  const item = scene.item ? itemById.get(scene.item) : null;

  return (
    <Page {...common} kind="search">
      <div className="mb-space-md px-margin flex flex-col gap-2">
        <p lang="en" className="font-georgia text-title-sm text-text-ivory text-center italic">
          “<GlossedText text={scene.task} glosses={glossesFor("task")} />”
        </p>
        <p className="font-caption text-caption text-text-muted text-center">{tr(scene.translation, locale)}</p>
      </div>
      <div className="px-margin mb-space-md">
        <div
          ref={box}
          className="relative w-full cursor-crosshair overflow-hidden rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.7)]"
          onClick={onPicture}
          role="img"
          aria-label={fill(t.scenes.searchPicture, { task: scene.task })}
          data-search-picture
        >
          {picture ? (
            <img src={picture} alt="" className="block w-full" draggable={false} />
          ) : (
            <div className="bg-surface-container aspect-video" />
          )}
          {scene.spots
            .filter((s) => found.includes(s.id))
            .map((s) => (
              <span
                key={s.id}
                className="border-status-success bg-status-success/15 pointer-events-none absolute rounded border-2"
                style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` }}
                data-found={s.id}
              />
            ))}
        </div>
      </div>
      {message ? (
        <p
          role="status"
          className={`px-margin mb-space-md font-body-md text-body-md text-center ${message.tone === "ok" ? "text-status-success" : message.tone === "bad" ? "text-status-error" : "text-on-surface-variant"}`}
        >
          {message.text}
        </p>
      ) : null}
      {!solved && wrong >= 2 ? (
        <div className="px-margin mb-space-md">
          <div className="bg-secondary-container/40 p-space-md text-on-surface flex gap-2 rounded-xl" data-search-hint>
            <Icon name="psychology" className="text-secondary text-[20px]" />
            <p>
              <span className="font-label-sm text-label-sm text-secondary block">{t.scenes.hint}</span>
              {tr(scene.hint, locale)}
            </p>
          </div>
        </div>
      ) : null}
      <div className="px-margin mb-space-lg flex flex-col gap-2">
        <span className="font-label-sm text-label-sm text-text-ivory">{t.scenes.searchList}</span>
        <span className="font-caption text-caption text-text-muted">{t.scenes.searchListNote}</span>
        <ul className="flex flex-wrap gap-2">
          {scene.spots.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                data-spot={s.id}
                aria-pressed={found.includes(s.id)}
                disabled={pending || solved || found.includes(s.id)}
                onClick={() => void tap(s.id)}
                className={`flex min-h-11 flex-col items-start rounded-lg px-3 py-1.5 text-left shadow-xs ${found.includes(s.id) ? "bg-status-success/20 text-status-success" : "bg-surface-container text-text-ivory"}`}
              >
                <span lang="en" className="font-label-md text-label-md">
                  {s.label}
                </span>
                <span className="font-caption text-caption text-text-muted">{tr(s.gloss, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {solved ? (
        <>
          <StoryReward
            label={t.scenes.done}
            title={t.scenes.found}
            text={item ? fill(t.scenes.newItem, { name: tr(item.name, locale) }) : tr(scene.translation, locale)}
            xp={scene.xp}
          />
          <div className="px-margin pb-space-lg flex flex-col items-center">
            <GoldButton label={t.story.next} onClick={onNext} action="next" />
          </div>
        </>
      ) : (
        <div className="px-margin pb-space-lg">
          <Failed t={t} error={error} />
        </div>
      )}
    </Page>
  );
}

/** A voice-acting scene inside the story: off to the scene, and on once the recording is sent (or, if allowed, without it). */
export function DubStoryScreen({
  exercise,
  text,
  translation,
  optional,
  onNext,
  ...common
}: Common & { exercise: string; text: string; translation: string; optional: boolean; onNext: () => void }) {
  const { t, base, facts } = useStudent();
  const { pending, error } = common;
  const assigned = worldOf(facts).dubs?.find((d) => d.exercise === exercise);
  const own = facts.dubs?.find((d) => d.exercise === exercise && d.version === assigned?.version);
  const sent = own?.status === "submitted" || own?.status === "approved";
  return (
    <Page {...common} kind="dub">
      <div className="mb-space-md px-margin flex flex-col gap-2 text-center">
        <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase">{t.scenes.dubIntro}</span>
        <p lang="en" className="font-georgia text-title-sm text-text-ivory italic">
          “{text}”
        </p>
        <p className="font-caption text-caption text-text-muted">{translation}</p>
      </div>
      <div className="px-margin mb-space-lg flex flex-col gap-3">
        {assigned ? (
          <Link
            href={`${base}/dub/${exercise}`}
            data-action="open-dub"
            className="bg-surface-container hover:bg-surface-container-high text-text-ivory font-label-md text-label-md flex h-12 items-center justify-center gap-2 rounded-lg shadow-xs"
          >
            <Icon name="mic" className="text-primary text-[20px]" /> {assigned.content.title} · {t.scenes.dubOpen}
          </Link>
        ) : (
          <p className="text-on-surface-variant text-center">{t.scenes.dubUnavailable}</p>
        )}
        <p className={`font-caption text-caption text-center ${sent ? "text-status-success" : "text-text-muted"}`} data-dub-sent={sent}>
          {sent ? t.scenes.dubSent : t.scenes.dubNotSent}
        </p>
      </div>
      <div className="px-margin pb-space-lg flex flex-col items-center gap-2">
        <GoldButton
          label={sent ? t.story.next : t.scenes.dubSkip}
          onClick={onNext}
          disabled={!sent && !optional}
          busy={pending}
          action="next"
        />
        <Failed t={t} error={error} />
      </div>
    </Page>
  );
}
