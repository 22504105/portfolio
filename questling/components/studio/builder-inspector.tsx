"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images */
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { Text } from "@/lib/content/text";
import { useStudio } from "@/lib/client/studio";
import { AudioField } from "./audio-field";
import { fill } from "@/lib/i18n";
import type { Draft } from "@/lib/studio/builder";
import { CEFR_LEVELS, type Cefr } from "@/lib/studio/model";
import type { CampaignKeys, Chapter, Clue, Condition, GradedScene, Next, Scene } from "@/lib/story/graph";
import { fieldText, glossFields } from "@/lib/story/graph";
import { anchored, occurrences, reanchor, type Support } from "@/lib/learning/gloss";
import { OBJECTIVE_IDS, OBJECTIVES } from "@/lib/learning/objectives";
import { tr } from "@/lib/content/text";
import { SCENE_IMAGES } from "@/lib/story/schema";
import { shuffled } from "@/lib/learning/shuffle";
import { DubForm, SearchForm, TalkForm } from "./story-forms";

// The builder's right pane (18_quest_builder, "Инспектор узла"): the form of the selected scene, by
// its kind, or — with nothing selected — the campaign's own properties, chapters and clues. Every
// field writes straight into the draft; the builder saves it. English is the lesson, so the story's
// lines are one English field and their translations a RU / EN pair.

const field =
  "w-full bg-surface-container text-text-ivory font-body-md text-body-md px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary shadow-sm";
const small =
  "w-full bg-surface-container-lowest text-text-ivory font-body-md text-body-md px-2.5 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-primary";
const card = "p-2.5 rounded-lg bg-surface-container flex flex-col gap-2 shadow-sm";
const LETTERS = "ABCDEFGH";

type Update = (fn: (draft: Draft) => void) => void;

export function Label({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <span className="font-label-sm text-label-sm text-text-ivory flex items-center justify-between gap-2">
      <span>{children}</span>
      {note ? <span className="font-caption text-text-muted text-[10px]">{note}</span> : null}
    </span>
  );
}

function Line({
  label,
  value,
  onChange,
  note,
  area = false,
  serif = false,
  compact = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  note?: string;
  area?: boolean;
  serif?: boolean;
  compact?: boolean;
}) {
  const cls = `${compact ? small : field} ${serif ? "font-headline-md text-[14px] font-serif italic leading-snug" : ""}`;
  return (
    <label className="flex flex-col gap-1.5">
      {label ? <Label note={note}>{label}</Label> : null}
      {area ? (
        <textarea className={`${cls} resize-none`} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={cls} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Pair({ label, value, onChange, compact = false }: { label: string; value: Text; onChange: (v: Text) => void; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-1.5">
        {(["ru", "en"] as const).map((l) => (
          <label key={l} className="relative">
            <span className="font-caption text-text-muted pointer-events-none absolute top-1 right-2 text-[9px] uppercase">{l}</span>
            <input
              className={`${compact ? small : field} pr-7`}
              type="text"
              value={value[l]}
              onChange={(e) => onChange({ ...value, [l]: e.target.value })}
              aria-label={`${label} (${l})`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="font-caption text-caption text-text-muted">{label}</span>
      <input
        className={`${small} w-20 text-right`}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
      />
    </label>
  );
}

function Pick<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <select className={field} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const list = (s: string, sep: RegExp) =>
  s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

/** The selected scene's form. */
export function SceneInspector({
  draft,
  scene,
  update,
  sceneLabel,
}: {
  draft: Draft;
  scene: Scene;
  update: Update;
  sceneLabel: (id: string) => string;
}) {
  const { t, locale } = useStudio();
  const f = t.builder.fields;
  const all = draft.graph.chapters.flatMap((c) => c.scenes);
  // Edits the selected scene inside the draft being changed.
  const edit = (fn: (s: Scene, keys: CampaignKeys) => void) =>
    update((d) => {
      const s = d.graph.chapters.flatMap((c) => c.scenes).find((x) => x.id === scene.id);
      if (!s) return;
      fn(s, d.keys);
      // Word help follows its words when the text around them is edited; a mark whose words are
      // gone stays where it was, shown as lost, until the teacher fixes the text or removes it.
      if (s.glosses)
        s.glosses = s.glosses.map((g) => {
          const text = fieldText(s, g.field);
          return text === null ? g : (reanchor(text, g) ?? g);
        });
    });
  const chapterCefr = draft.graph.chapters.find((c) => c.scenes.some((x) => x.id === scene.id))?.cefr ?? draft.graph.cefr;
  const targets = all.filter((s) => s.id !== scene.id).map((s) => ({ value: s.id, label: sceneLabel(s.id) }));
  const clues = draft.graph.clues;

  return (
    <div className="gap-space-md flex flex-col">
      <Pair label={f.location} value={scene.location} onChange={(v) => edit((s) => (s.location = v))} />
      <div className="flex flex-col gap-1.5">
        <Label>{f.image}</Label>
        <div className="grid grid-cols-6 gap-1">
          {SCENE_IMAGES.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => edit((s) => (s.image = src))}
              aria-pressed={scene.image === src}
              className={`aspect-square overflow-hidden rounded ${scene.image === src ? "ring-primary ring-2" : "opacity-60 hover:opacity-100"}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {scene.kind === "narration" ? (
        <>
          <Line label={f.text} value={scene.text} onChange={(v) => edit((s) => s.kind === "narration" && (s.text = v))} area />
          <Pair
            label={f.translation}
            value={scene.translation}
            onChange={(v) => edit((s) => s.kind === "narration" && (s.translation = v))}
          />
          <ClueSelect value={scene.clue} clues={clues} onChange={(v) => edit((s) => s.kind === "narration" && (s.clue = v))} />
          <AudioField value={scene.audio} onChange={(v) => edit((s) => s.kind === "narration" && (v ? (s.audio = v) : delete s.audio))} />
        </>
      ) : null}

      {scene.kind === "dialogue" ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>{f.lines}</Label>
              <AddButton
                label={f.addLine}
                onClick={() =>
                  edit(
                    (s) =>
                      s.kind === "dialogue" &&
                      s.lines.push({ speaker: { ...s.lines.at(-1)!.speaker }, text: "…", translation: { ru: "…", en: "…" } }),
                  )
                }
              />
            </div>
            {scene.lines.map((line, i) => (
              <div key={i} className={card}>
                <div className="flex items-center justify-between">
                  <span className="font-caption text-caption text-text-muted">#{i + 1}</span>
                  {scene.lines.length > 1 ? (
                    <RemoveButton onClick={() => edit((s) => s.kind === "dialogue" && s.lines.splice(i, 1))} />
                  ) : null}
                </div>
                <Pair
                  label={f.speaker}
                  value={line.speaker}
                  onChange={(v) => edit((s) => s.kind === "dialogue" && (s.lines[i].speaker = v))}
                  compact
                />
                <Line
                  label={f.line}
                  value={line.text}
                  onChange={(v) => edit((s) => s.kind === "dialogue" && (s.lines[i].text = v))}
                  compact
                />
                <Pair
                  label={f.translation}
                  value={line.translation}
                  onChange={(v) => edit((s) => s.kind === "dialogue" && (s.lines[i].translation = v))}
                  compact
                />
              </div>
            ))}
          </div>
          <ClueSelect value={scene.clue} clues={clues} onChange={(v) => edit((s) => s.kind === "dialogue" && (s.clue = v))} />
          <AudioField value={scene.audio} onChange={(v) => edit((s) => s.kind === "dialogue" && (v ? (s.audio = v) : delete s.audio))} />
        </>
      ) : null}

      {scene.kind === "choice" ? (
        <>
          <Line label={f.text} value={scene.text} onChange={(v) => edit((s) => s.kind === "choice" && (s.text = v))} area />
          <Pair label={f.translation} value={scene.translation} onChange={(v) => edit((s) => s.kind === "choice" && (s.translation = v))} />
          <Pair label={f.prompt} value={scene.prompt} onChange={(v) => edit((s) => s.kind === "choice" && (s.prompt = v))} />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>{f.options}</Label>
              {scene.options.length < 4 ? (
                <AddButton
                  label={f.add}
                  onClick={() =>
                    edit((s) => {
                      if (s.kind !== "choice") return;
                      const last = s.options.at(-1)!;
                      s.options.push({ ...structuredClone(last), id: freshOption(s.options.map((o) => o.id)), label: "Another way" });
                    })
                  }
                />
              ) : null}
            </div>
            {scene.options.map((o, i) => (
              <div key={o.id} className={card}>
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-text-ivory">{fill(f.option, { letter: LETTERS[i] })}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-caption bg-surface-container-high text-text-muted rounded px-1.5 py-0.5 text-[10px]">
                      ID: #{o.id}
                    </span>
                    {scene.options.length > 2 ? (
                      <RemoveButton onClick={() => edit((s) => s.kind === "choice" && s.options.splice(i, 1))} />
                    ) : null}
                  </div>
                </div>
                <Line value={o.label} onChange={(v) => edit((s) => s.kind === "choice" && (s.options[i].label = v))} compact />
                <Pair
                  label={f.gloss}
                  value={o.gloss}
                  onChange={(v) => edit((s) => s.kind === "choice" && (s.options[i].gloss = v))}
                  compact
                />
                <TargetSelect
                  label={f.target}
                  value={o.to}
                  options={targets}
                  onChange={(v) => edit((s) => s.kind === "choice" && (s.options[i].to = v))}
                />
                <Line
                  label={f.setFlags}
                  value={(o.set ?? []).join(", ")}
                  onChange={(v) =>
                    edit(
                      (s) =>
                        s.kind === "choice" &&
                        (s.options[i].set = list(v.toLowerCase(), /[,\s]+/).length ? list(v.toLowerCase(), /[,\s]+/) : undefined),
                    )
                  }
                  compact
                />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {scene.kind === "question" ? <QuestionForm scene={scene} draft={draft} edit={edit} /> : null}
      {scene.kind === "puzzle" ? <PuzzleForm scene={scene} draft={draft} edit={edit} /> : null}
      {scene.kind === "evidence" ? <EvidenceForm scene={scene} draft={draft} edit={edit} /> : null}
      {scene.kind === "talk" ? <TalkForm scene={scene} clues={clues} edit={edit} /> : null}
      {scene.kind === "search" ? <SearchForm scene={scene} keys={draft.keys} clues={clues} edit={edit} /> : null}
      {scene.kind === "dub" ? <DubForm scene={scene} clues={clues} edit={edit} /> : null}

      {scene.kind === "ending" ? (
        <>
          <Pair label={f.endingTitle} value={scene.title} onChange={(v) => edit((s) => s.kind === "ending" && (s.title = v))} />
          <Line label={f.text} value={scene.text} onChange={(v) => edit((s) => s.kind === "ending" && (s.text = v))} area />
          <Pair label={f.translation} value={scene.translation} onChange={(v) => edit((s) => s.kind === "ending" && (s.translation = v))} />
          <Pick
            label={f.tone}
            value={scene.tone}
            options={(["bright", "bittersweet", "secret"] as const).map((v) => ({ value: v, label: f.tones[v] }))}
            onChange={(v) => edit((s) => s.kind === "ending" && (s.tone = v))}
          />
          <div className={card}>
            <Num
              label={f.rewardXp}
              value={scene.reward.xp}
              max={500}
              onChange={(v) => edit((s) => s.kind === "ending" && (s.reward.xp = v))}
            />
            <Num
              label={f.rewardCoins}
              value={scene.reward.coins}
              max={500}
              onChange={(v) => edit((s) => s.kind === "ending" && (s.reward.coins = v))}
            />
          </div>
        </>
      ) : null}

      {scene.kind === "question" || scene.kind === "evidence" ? (
        <label className="font-caption text-caption text-on-surface-variant flex items-start gap-2">
          <input
            type="checkbox"
            data-field="shuffle"
            checked={scene.shuffle !== false}
            onChange={(e) =>
              edit((s) => {
                if (s.kind === "question" || s.kind === "evidence") s.shuffle = e.target.checked ? undefined : false;
              })
            }
          />
          <span>
            <span className="text-text-ivory font-label-sm text-label-sm block">{t.builder.words.shuffle}</span>
            {t.builder.words.shuffleNote}
          </span>
        </label>
      ) : null}
      {scene.kind === "question" || scene.kind === "puzzle" || scene.kind === "evidence" ? (
        <label className="flex flex-col gap-1.5">
          <Label note={t.builder.words.objectiveNote}>{t.builder.words.objective}</Label>
          <select
            className={field}
            data-field="objective"
            value={scene.objective ?? ""}
            onChange={(e) =>
              edit((s) => {
                if (s.kind === "question" || s.kind === "puzzle" || s.kind === "evidence") s.objective = e.target.value || undefined;
              })
            }
          >
            <option value="">{t.builder.words.objectiveNone}</option>
            {OBJECTIVE_IDS.map((id) => (
              <option key={id} value={id}>
                {tr(OBJECTIVES[id], locale)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <GlossForm key={scene.id} scene={scene} cefr={chapterCefr} edit={edit} />
      {scene.kind !== "ending" && scene.kind !== "choice" ? <NextForm scene={scene} targets={targets} clues={clues} edit={edit} /> : null}
      {scene.kind === "question" || scene.kind === "puzzle" || scene.kind === "evidence" ? (
        <Method scene={scene} draft={draft} edit={edit} />
      ) : null}
    </div>
  );
}

const freshOption = (used: string[]) => {
  for (let n = 1; ; n++) if (!used.includes(`option-${n}`)) return `option-${n}`;
};

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="font-caption text-caption text-primary flex items-center gap-0.5 hover:underline">
      <Icon name="add" className="text-[14px]" /> {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const { t } = useStudio();
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-text-muted hover:text-status-error p-0.5 transition-colors"
      aria-label={t.common.remove}
      title={t.common.remove}
    >
      <Icon name="close" className="text-[16px]" />
    </button>
  );
}

function TargetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="font-caption text-caption text-text-muted flex items-center justify-between gap-2 pt-1">
      <span className="shrink-0">{label}</span>
      <select
        className="bg-surface-container-high text-primary font-caption text-caption max-w-[60%] rounded px-2 py-0.5 font-medium focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClueSelect({ value, clues, onChange }: { value: string | undefined; clues: Clue[]; onChange: (v: string | undefined) => void }) {
  const { t, locale } = useStudio();
  return (
    <Pick
      label={t.builder.fields.clue}
      value={value ?? ""}
      options={[{ value: "", label: t.builder.fields.noClue }, ...clues.map((c) => ({ value: c.id, label: c.title[locale] }))]}
      onChange={(v) => onChange(v || undefined)}
    />
  );
}

type Edit = (fn: (s: Scene, keys: CampaignKeys) => void) => void;

function QuestionForm({ scene, draft, edit }: { scene: Extract<Scene, { kind: "question" }>; draft: Draft; edit: Edit }) {
  const { t } = useStudio();
  const f = t.builder.fields;
  const key = draft.keys[scene.id];
  const correct = key?.kind === "question" ? key.correct : null;
  const q = (fn: (s: Extract<Scene, { kind: "question" }>, k: Extract<CampaignKeys[string], { kind: "question" }>) => void) =>
    edit((s, keys) => {
      if (s.kind !== "question") return;
      const k = keys[s.id];
      const own =
        k?.kind === "question"
          ? k
          : (keys[s.id] = { kind: "question", correct: s.options[0].id, explanations: {}, grimoire: s.grimoire.quiz.options[0] });
      fn(s, own as Extract<CampaignKeys[string], { kind: "question" }>);
    });
  return (
    <>
      <Line
        label={f.parchment}
        note={scene.parchment.includes("___") ? f.fillNote : f.parchmentNote}
        value={scene.parchment}
        onChange={(v) => q((s) => (s.parchment = v))}
        area
        serif
      />
      <label className="font-label-sm text-label-sm text-text-ivory flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!scene.listen}
          onChange={(e) => q((s) => (s.listen = e.target.checked || undefined))}
          className="accent-[#b99a61]"
        />
        <Icon name="hearing" className="text-secondary text-[18px]" />
        <span>{f.listen}</span>
      </label>
      <AudioField value={scene.audio} onChange={(v) => q((s) => (v ? (s.audio = v) : delete s.audio))} />
      <Pair label={f.translation} value={scene.translation} onChange={(v) => q((s) => (s.translation = v))} />
      <Pair label={f.lead} value={scene.prompt.lead} onChange={(v) => q((s) => (s.prompt.lead = v))} />
      <Pair label={f.task} value={scene.prompt.task} onChange={(v) => q((s) => (s.prompt.task = v))} />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>{f.options}</Label>
          {scene.options.length < 4 ? (
            <AddButton
              label={f.add}
              onClick={() =>
                q((s, k) => {
                  const id = freshOption(s.options.map((o) => o.id));
                  s.options.push({
                    id,
                    label: "Another answer",
                    gloss: { ru: "Другой ответ", en: "Another answer" },
                    icon: s.options.at(-1)!.icon,
                  });
                  k.explanations[id] = { ru: "Не то.", en: "Not that." };
                })
              }
            />
          ) : null}
        </div>
        {scene.options.map((o, i) => {
          const right = o.id === correct;
          const explanation = key?.kind === "question" ? (key.explanations[o.id] ?? { ru: "", en: "" }) : { ru: "", en: "" };
          return (
            <div key={o.id} className={card} data-option={o.id}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => q((_, k) => (k.correct = o.id))}
                  className="flex items-center gap-2"
                  aria-pressed={right}
                >
                  <Icon
                    name={right ? "check_circle" : "radio_button_unchecked"}
                    className={`text-[18px] ${right ? "text-status-success" : "text-text-muted"}`}
                  />
                  <span className={`font-label-sm text-label-sm ${right ? "text-status-success font-semibold" : "text-text-ivory"}`}>
                    {fill(f.option, { letter: LETTERS[i] })} ({right ? f.correctOption : f.wrongOption})
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <span className="font-caption bg-surface-container-high text-text-muted rounded px-1.5 py-0.5 text-[10px]">
                    ID: #{o.id}
                  </span>
                  {scene.options.length > 2 && !right ? (
                    <RemoveButton onClick={() => q((s, k) => (s.options.splice(i, 1), delete k.explanations[o.id]))} />
                  ) : null}
                </div>
              </div>
              <Line value={o.label} onChange={(v) => q((s) => (s.options[i].label = v))} compact />
              <Pair label={f.gloss} value={o.gloss} onChange={(v) => q((s) => (s.options[i].gloss = v))} compact />
              <Pair label={f.explanation} value={explanation} onChange={(v) => q((_, k) => (k.explanations[o.id] = v))} compact />
            </div>
          );
        })}
      </div>
    </>
  );
}

function PuzzleForm({ scene, draft, edit }: { scene: Extract<Scene, { kind: "puzzle" }>; draft: Draft; edit: Edit }) {
  const { t } = useStudio();
  const f = t.builder.fields;
  const key = draft.keys[scene.id];
  const order = key?.kind === "puzzle" ? key.order : scene.tiles;
  const p = (fn: (s: Extract<Scene, { kind: "puzzle" }>, k: Extract<CampaignKeys[string], { kind: "puzzle" }>) => void) =>
    edit((s, keys) => {
      if (s.kind !== "puzzle") return;
      const k =
        keys[s.id]?.kind === "puzzle"
          ? keys[s.id]
          : (keys[s.id] = { kind: "puzzle", order: [...s.tiles], explanation: { ru: "", en: "" }, grimoire: s.grimoire.quiz.options[0] });
      fn(s, k as Extract<CampaignKeys[string], { kind: "puzzle" }>);
    });
  return (
    <>
      <Line label={f.parchment} note={f.parchmentNote} value={scene.parchment} onChange={(v) => p((s) => (s.parchment = v))} area serif />
      <Pair label={f.translation} value={scene.translation} onChange={(v) => p((s) => (s.translation = v))} />
      <Pair label={f.puzzleTitle} value={scene.title} onChange={(v) => p((s) => (s.title = v))} />
      <Pair label={f.task} value={scene.task} onChange={(v) => p((s) => (s.task = v))} />
      <Line
        label={f.tiles}
        note={f.tilesNote}
        value={order.join(" | ")}
        onChange={(v) =>
          p((s, k) => {
            const words = list(v, /\|/);
            k.order = words;
            // The board starts with the words mixed at random (not just turned round by one, which a
            // student would learn to undo), never already solved unless all are the same.
            s.tiles = scramble(words);
          })
        }
      />
      <Pair
        label={f.explanation}
        value={key?.kind === "puzzle" ? key.explanation : { ru: "", en: "" }}
        onChange={(v) => p((_, k) => (k.explanation = v))}
      />
    </>
  );
}

function EvidenceForm({ scene, draft, edit }: { scene: Extract<Scene, { kind: "evidence" }>; draft: Draft; edit: Edit }) {
  const { t, locale } = useStudio();
  const f = t.builder.fields;
  const key = draft.keys[scene.id];
  const correct = key?.kind === "evidence" ? key.correct : [];
  const e = (fn: (s: Extract<Scene, { kind: "evidence" }>, k: Extract<CampaignKeys[string], { kind: "evidence" }>) => void) =>
    edit((s, keys) => {
      if (s.kind !== "evidence") return;
      const k =
        keys[s.id]?.kind === "evidence"
          ? keys[s.id]
          : (keys[s.id] = { kind: "evidence", correct: [], explanations: {}, grimoire: s.grimoire.quiz.options[0] });
      fn(s, k as Extract<CampaignKeys[string], { kind: "evidence" }>);
    });
  return (
    <>
      <Line label={f.question} value={scene.question} onChange={(v) => e((s) => (s.question = v))} area />
      <Pair label={f.translation} value={scene.translation} onChange={(v) => e((s) => (s.translation = v))} />
      <Pair label={f.prompt} value={scene.prompt} onChange={(v) => e((s) => (s.prompt = v))} />
      <div className="flex flex-col gap-2">
        <Label>{f.offered}</Label>
        {draft.graph.clues.map((clue) => {
          const offered = scene.clues.includes(clue.id);
          const proving = correct.includes(clue.id);
          return (
            <div key={clue.id} className={card}>
              <div className="flex items-center justify-between gap-2">
                <label className="font-label-sm text-label-sm text-text-ivory flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-[#b99a61]"
                    checked={offered}
                    onChange={(ev) =>
                      e((s, k) => {
                        if (ev.target.checked) {
                          s.clues.push(clue.id);
                          k.explanations[clue.id] ??= { ru: "", en: "" };
                        } else {
                          s.clues = s.clues.filter((c) => c !== clue.id);
                          k.correct = k.correct.filter((c) => c !== clue.id);
                          delete k.explanations[clue.id];
                        }
                      })
                    }
                  />
                  <span>{clue.title[locale]}</span>
                </label>
                {offered ? (
                  <label
                    className={`font-caption text-caption flex items-center gap-1 ${proving ? "text-status-success" : "text-text-muted"}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#63BA9E]"
                      checked={proving}
                      onChange={(ev) =>
                        e((_, k) => (k.correct = ev.target.checked ? [...k.correct, clue.id] : k.correct.filter((c) => c !== clue.id)))
                      }
                    />
                    {f.proving}
                  </label>
                ) : null}
              </div>
              {offered && key?.kind === "evidence" ? (
                <Pair
                  label={f.explanation}
                  value={key.explanations[clue.id] ?? { ru: "", en: "" }}
                  onChange={(v) => e((_, k) => (k.explanations[clue.id] = v))}
                  compact
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** "Методические параметры": attempts, reward, the hint and the grimoire of a graded scene. */
function Method({ scene, draft, edit }: { scene: GradedScene; draft: Draft; edit: Edit }) {
  const { t, locale } = useStudio();
  const f = t.builder.fields;
  const g = (fn: (s: GradedScene, keys: CampaignKeys) => void) =>
    edit((s, keys) => (s.kind === "question" || s.kind === "puzzle" || s.kind === "evidence") && fn(s, keys));
  const key = draft.keys[scene.id];
  return (
    <div className="bg-surface-container flex flex-col gap-2 rounded-lg p-3 shadow-sm">
      <span className="font-caption text-primary text-[11px] font-bold tracking-wider uppercase">{f.method}</span>
      <Num label={f.attempts} value={scene.maxAttempts} min={1} max={5} onChange={(v) => g((s) => (s.maxAttempts = v))} />
      <Num label={f.xp} value={scene.xp} max={500} onChange={(v) => g((s) => (s.xp = v))} />
      <ClueSelect value={scene.clue} clues={draft.graph.clues} onChange={(v) => g((s) => (s.clue = v))} />
      <Pair label={`${f.hint}: ${f.hintTopic}`} value={scene.hint.topic} onChange={(v) => g((s) => (s.hint.topic = v))} compact />
      <Pair label={f.hint} value={scene.hint.text} onChange={(v) => g((s) => (s.hint.text = v))} compact />
      <details className="flex flex-col gap-2">
        <summary className="font-label-sm text-label-sm text-text-ivory cursor-pointer">
          {f.grimoire}: {scene.grimoire.title[locale]}
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <Pair label={f.grimoireTitle} value={scene.grimoire.title} onChange={(v) => g((s) => (s.grimoire.title = v))} compact />
          <Num label={f.minutes} value={scene.grimoire.minutes} min={1} max={30} onChange={(v) => g((s) => (s.grimoire.minutes = v))} />
          <Pair label={f.heading} value={scene.grimoire.rule.heading} onChange={(v) => g((s) => (s.grimoire.rule.heading = v))} compact />
          <Line label={f.formula} value={scene.grimoire.rule.formula} onChange={(v) => g((s) => (s.grimoire.rule.formula = v))} compact />
          <Pair label={f.ruleText} value={scene.grimoire.rule.text} onChange={(v) => g((s) => (s.grimoire.rule.text = v))} compact />
          <Pair label={f.deduction} value={scene.grimoire.deduction} onChange={(v) => g((s) => (s.grimoire.deduction = v))} compact />
          <Line label={f.quiz} value={scene.grimoire.quiz.sentence} onChange={(v) => g((s) => (s.grimoire.quiz.sentence = v))} compact />
          <Line
            label={f.quizOptions}
            value={scene.grimoire.quiz.options.join(" | ")}
            onChange={(v) => g((s) => (s.grimoire.quiz.options = list(v, /\|/)))}
            compact
          />
          <Pick
            label={f.quizAnswer}
            value={key && "grimoire" in key ? key.grimoire : ""}
            options={scene.grimoire.quiz.options.map((o) => ({ value: o, label: o }))}
            onChange={(v) =>
              g((s, keys) => {
                const k = keys[s.id];
                if (k && "grimoire" in k) k.grimoire = v;
              })
            }
          />
        </div>
      </details>
    </div>
  );
}

/** Where a scene goes next: in chapter order, one chosen scene, or branches by condition. */
function NextForm({
  scene,
  targets,
  clues,
  edit,
}: {
  scene: Scene;
  targets: { value: string; label: string }[];
  clues: Clue[];
  edit: Edit;
}) {
  const { t, locale } = useStudio();
  const f = t.builder.fields;
  const next = scene.next;
  const setNext = (n: Next | undefined) => edit((s) => s.kind !== "ending" && s.kind !== "choice" && (s.next = n));
  if (!Array.isArray(next)) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label>{f.next}</Label>
          <AddButton
            label={f.addBranch}
            onClick={() =>
              setNext([
                { when: { flag: "flag" }, to: targets[0].value },
                { when: { all: [] }, to: next ?? targets[0].value },
              ])
            }
          />
        </div>
        <select className={field} value={next ?? ""} onChange={(e) => setNext(e.target.value || undefined)}>
          <option value="">{f.nextAuto}</option>
          {targets.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const branches = next.slice(0, -1);
  const otherwise = next.at(-1)!;
  const write = (list: { when: Condition; to: string }[], last: string) =>
    setNext(list.length ? [...list, { when: { all: [] }, to: last }] : last);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{f.conditions}</Label>
        <AddButton
          label={f.addBranch}
          onClick={() => write([...branches, { when: { flag: "flag" }, to: targets[0].value }], otherwise.to)}
        />
      </div>
      {branches.map((b, i) => {
        const isClue = "clue" in b.when;
        const value = "flag" in b.when ? b.when.flag : "clue" in b.when ? b.when.clue : "";
        const set = (when: Condition, to = b.to) =>
          write(
            branches.map((x, j) => (j === i ? { when, to } : x)),
            otherwise.to,
          );
        return (
          <div key={i} className={card}>
            <div className="flex items-center gap-2">
              <span className="font-caption text-caption text-text-muted">{f.when}</span>
              <select
                className={`${small} w-auto`}
                value={isClue ? "clue" : "flag"}
                onChange={(e) => set(e.target.value === "clue" ? { clue: clues[0]?.id ?? "clue" } : { flag: "flag" })}
              >
                <option value="flag">{f.flag}</option>
                <option value="clue">{f.hasClue}</option>
              </select>
              {isClue ? (
                <select className={small} value={value} onChange={(e) => set({ clue: e.target.value })}>
                  {clues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title[locale]}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={small}
                  value={value}
                  onChange={(e) => set({ flag: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") || "flag" })}
                />
              )}
              <RemoveButton
                onClick={() =>
                  write(
                    branches.filter((_, j) => j !== i),
                    otherwise.to,
                  )
                }
              />
            </div>
            <TargetSelect label={f.target} value={b.to} options={targets} onChange={(to) => set(b.when, to)} />
          </div>
        );
      })}
      <div className={card}>
        <TargetSelect label={f.otherwise} value={otherwise.to} options={targets} onChange={(to) => write(branches, to)} />
      </div>
    </div>
  );
}

/** With nothing selected: the campaign's title and level, its chapters and its clues. */
export function CampaignInspector({ draft, update, onCefr }: { draft: Draft; update: Update; onCefr: (cefr: Cefr) => void }) {
  const { t } = useStudio();
  const f = t.builder.fields;
  const g = draft.graph;
  const chapter = (i: number, fn: (c: Chapter) => void) => update((d) => fn(d.graph.chapters[i]));
  const clue = (i: number, fn: (c: Clue) => void) => update((d) => fn(d.graph.clues[i]));
  return (
    <div className="gap-space-md flex flex-col">
      <Pair label={f.campaignTitle} value={g.title} onChange={(v) => update((d) => (d.graph.title = v))} />
      <Pick
        label={f.cefr}
        value={(CEFR_LEVELS as readonly string[]).includes(g.cefr) ? (g.cefr as Cefr) : "A2"}
        options={CEFR_LEVELS.map((l) => ({ value: l, label: t.groups.levels[l] }))}
        onChange={(v) => {
          update((d) => {
            d.graph.cefr = v;
            for (const c of d.graph.chapters) c.cefr = v;
          });
          onCefr(v);
        }}
      />
      <Pick
        label={t.builder.words.support}
        value={g.support ?? "auto"}
        options={(["auto", "all", "none"] as const).map((v) => ({ value: v, label: t.builder.words.supportOptions[v] }))}
        onChange={(v: Support) => update((d) => (d.graph.support = v === "auto" ? undefined : v))}
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>{f.chapters}</Label>
          <AddButton
            label={f.addChapter}
            onClick={() =>
              update((d) => {
                const last = d.graph.chapters.at(-1)!;
                const n = d.graph.chapters.length + 1;
                const used = new Set(d.graph.chapters.flatMap((c) => c.scenes.map((s) => s.id)));
                let id = `scene-${n}`;
                for (let k = 1; used.has(id); k++) id = `scene-${n}-${k}`;
                d.graph.chapters.push({
                  ...structuredClone(last),
                  id: `chapter-${n}-${Date.now().toString(36).slice(-4)}`,
                  label: { ru: `Глава ${n}`, en: `Chapter ${n}` },
                  labelAccusative: { ru: `Главу ${n}`, en: `Chapter ${n}` },
                  gate: undefined,
                  scenes: [
                    {
                      kind: "narration",
                      id,
                      location: last.scenes[0].location,
                      image: last.image,
                      text: "A new chapter begins.",
                      translation: { ru: "Начинается новая глава.", en: "A new chapter begins." },
                    },
                  ],
                });
              })
            }
          />
        </div>
        {g.chapters.map((c, i) => (
          <details key={c.id} className={card} open={g.chapters.length === 1}>
            <summary className="font-label-sm text-label-sm text-text-ivory flex cursor-pointer items-center justify-between">
              <span>
                {c.label.ru} • {c.title.ru}
              </span>
              {g.chapters.length > 1 ? <RemoveButton onClick={() => update((d) => d.graph.chapters.splice(i, 1))} /> : null}
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Pair label={f.chapterLabel} value={c.label} onChange={(v) => chapter(i, (x) => (x.label = v))} compact />
              <Pair
                label={f.chapterLabelAcc}
                value={c.labelAccusative}
                onChange={(v) => chapter(i, (x) => (x.labelAccusative = v))}
                compact
              />
              <Pair label={f.chapterTitle} value={c.title} onChange={(v) => chapter(i, (x) => (x.title = v))} compact />
              <Pair label={f.subtitle} value={c.subtitle} onChange={(v) => chapter(i, (x) => (x.subtitle = v))} compact />
              <Pair label={f.description} value={c.description} onChange={(v) => chapter(i, (x) => (x.description = v))} compact />
              <Pair label={f.skills} value={c.skills} onChange={(v) => chapter(i, (x) => (x.skills = v))} compact />
              <Pair label={f.mission} value={c.mission} onChange={(v) => chapter(i, (x) => (x.mission = v))} compact />
              <Line label={f.words} value={c.words.join(", ")} onChange={(v) => chapter(i, (x) => (x.words = list(v, /,/)))} compact />
              <Num label={f.minutesChapter} value={c.minutes} min={1} max={120} onChange={(v) => chapter(i, (x) => (x.minutes = v))} />
              <Num
                label={`${f.chapterReward}: ${f.rewardXp}`}
                value={c.reward.xp}
                max={500}
                onChange={(v) => chapter(i, (x) => (x.reward.xp = v))}
              />
              <Num
                label={`${f.chapterReward}: ${f.rewardCoins}`}
                value={c.reward.coins}
                max={500}
                onChange={(v) => chapter(i, (x) => (x.reward.coins = v))}
              />
              <div className="grid grid-cols-6 gap-1">
                {SCENE_IMAGES.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => chapter(i, (x) => (x.image = src))}
                    aria-pressed={c.image === src}
                    className={`aspect-square overflow-hidden rounded ${c.image === src ? "ring-primary ring-2" : "opacity-60 hover:opacity-100"}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </details>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>{f.clues}</Label>
          <AddButton
            label={f.newClue}
            onClick={() =>
              update((d) => {
                const used = new Set(d.graph.clues.map((c) => c.id));
                let n = d.graph.clues.length + 1;
                while (used.has(`clue-${n}`)) n++;
                const base = d.graph.clues[0];
                d.graph.clues.push({
                  id: `clue-${n}`,
                  title: { ru: `Улика ${n}`, en: `Clue ${n}` },
                  english: `Clue ${n}`,
                  location: base?.location ?? { ru: "Библиотека", en: "The library" },
                  image: "/images/sealed-letter.webp",
                  description: { ru: "Опишите улику.", en: "Describe the clue." },
                  phrase: { text: "Something was written here.", glosses: [] },
                  tags: [],
                  deduction: { ru: "Что из этого следует?", en: "What does it tell us?" },
                  teaser: { ru: "Пока не найдена", en: "Not found yet" },
                  onward: { ru: "Дальше", en: "Onward" },
                });
              })
            }
          />
        </div>
        {g.clues.map((c, i) => (
          <details key={c.id} className={card}>
            <summary className="font-label-sm text-label-sm text-text-ivory flex cursor-pointer items-center justify-between">
              <span>
                {c.title.ru} <span className="text-text-muted font-caption">#{c.id}</span>
              </span>
              <RemoveButton
                onClick={() =>
                  update((d) => {
                    d.graph.clues.splice(i, 1);
                    for (const s of d.graph.chapters.flatMap((ch) => ch.scenes)) {
                      if ("clue" in s && s.clue === c.id) s.clue = undefined;
                      if (s.kind === "evidence") s.clues = s.clues.filter((x) => x !== c.id);
                    }
                    for (const k of Object.values(d.keys))
                      if (k.kind === "evidence") {
                        k.correct = k.correct.filter((x) => x !== c.id);
                        delete k.explanations[c.id];
                      }
                  })
                }
              />
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Pair label={f.clueTitle} value={c.title} onChange={(v) => clue(i, (x) => (x.title = v))} compact />
              <Line label={f.clueEnglish} value={c.english} onChange={(v) => clue(i, (x) => (x.english = v))} compact />
              <Pair label={f.clueDescription} value={c.description} onChange={(v) => clue(i, (x) => (x.description = v))} compact />
              <Line label={f.cluePhrase} value={c.phrase.text} onChange={(v) => clue(i, (x) => (x.phrase.text = v))} compact />
              <Pair label={f.clueDeduction} value={c.deduction} onChange={(v) => clue(i, (x) => (x.deduction = v))} compact />
              <Pair label={f.clueTeaser} value={c.teaser} onChange={(v) => clue(i, (x) => (x.teaser = v))} compact />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** The words in a random order other than the given one (when there is any other). */
function scramble(words: string[]): string[] {
  if (new Set(words).size < 2) return words;
  for (;;) {
    const mixed = shuffled(words, `${Date.now()}|${Math.random()}`);
    if (mixed.join("\u0000") !== words.join("\u0000")) return mixed;
  }
}

/** Words with translations (lib/learning/gloss.ts): marked on the scene's English texts by place and words. */
function GlossForm({ scene, cefr, edit }: { scene: Scene; cefr: string; edit: Edit }) {
  const { t } = useStudio();
  const w = t.builder.words;
  const fields = glossFields(scene);
  const [field, setField] = useState(fields[0]?.field ?? "text");
  const [phrase, setPhrase] = useState("");
  const [occurrence, setOccurrence] = useState(0);
  const [ru, setRu] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [note, setNote] = useState<Text>({ ru: "", en: "" });
  const [level, setLevel] = useState<Cefr | "">("");
  const [answer, setAnswer] = useState(false);
  const text = fields.find((x) => x.field === field)?.text ?? "";
  const places = occurrences(text, phrase.trim());
  const glosses = scene.glosses ?? [];
  const fieldName = (name: string) =>
    name.startsWith("line:") ? fill(w.fields.line, { n: Number(name.slice(5)) + 1 }) : w.fields[name as keyof typeof w.fields];
  const ready = places.length > 0 && ru.trim().length > 0;

  const add = () => {
    const words = phrase.trim();
    const start = places[Math.min(occurrence, places.length - 1)];
    if (!ready || start === undefined) return;
    edit((s) => {
      const taken = new Set((s.glosses ?? []).map((g) => g.id));
      let n = (s.glosses ?? []).length + 1;
      while (taken.has(`w${n}`)) n++;
      s.glosses = [
        ...(s.glosses ?? []),
        {
          id: `w${n}`,
          field,
          start,
          end: start + words.length,
          phrase: words,
          ru: ru.trim(),
          ...(definition.trim() ? { definition: definition.trim() } : {}),
          ...(example.trim() ? { example: example.trim() } : {}),
          ...(note.ru.trim() || note.en.trim() ? { note } : {}),
          ...(level ? { cefr: level } : {}),
          ...(answer ? { answer: true } : {}),
        },
      ];
    });
    setPhrase("");
    setRu("");
    setDefinition("");
    setExample("");
    setNote({ ru: "", en: "" });
    setLevel("");
    setAnswer(false);
    setOccurrence(0);
  };

  return (
    <div className="flex flex-col gap-2" data-glosses={scene.id}>
      <Label note={w.note}>{w.title}</Label>
      {glosses.length ? (
        <ul className="flex flex-col gap-1.5">
          {glosses.map((g) => {
            const current = fieldText(scene, g.field);
            const lost = current === null || !anchored(current, g);
            return (
              <li key={g.id} className={`${card} ${lost ? "ring-status-error ring-1" : ""}`} data-gloss-row={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span lang="en" className="font-title-sm text-title-sm text-text-ivory truncate">
                      {g.phrase}
                    </span>
                    <span className="font-caption text-caption text-text-muted">
                      {fieldName(g.field)} · {g.ru}
                      {g.cefr ? ` · ${g.cefr}` : ""}
                    </span>
                  </div>
                  <RemoveButtonLabelled
                    label={fill(w.remove, { phrase: g.phrase })}
                    onClick={() => edit((s) => (s.glosses = (s.glosses ?? []).filter((x) => x.id !== g.id)))}
                  />
                </div>
                <label className="font-caption text-caption text-on-surface-variant flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!g.answer}
                    onChange={(e) =>
                      edit((s) => {
                        const x = s.glosses?.find((y) => y.id === g.id);
                        if (x) x.answer = e.target.checked || undefined;
                      })
                    }
                  />
                  {w.answer}
                </label>
                {lost ? <span className="font-caption text-caption text-status-error">{w.lost}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="font-caption text-caption text-text-muted">{w.empty}</p>
      )}
      <div className={card}>
        {fields.length > 1 ? (
          <Pick
            label={w.field}
            value={field}
            options={fields.map((x) => ({ value: x.field, label: fieldName(x.field) }))}
            onChange={(v) => {
              setField(v);
              setOccurrence(0);
            }}
          />
        ) : null}
        <Line label={w.phrase} value={phrase} onChange={(v) => (setPhrase(v), setOccurrence(0))} compact />
        {phrase.trim() && !places.length ? <span className="font-caption text-caption text-status-error">{w.notFound}</span> : null}
        {places.length > 1 ? (
          <Pick
            label={w.occurrence}
            value={String(occurrence)}
            options={places.map((p, i) => ({
              value: String(i),
              label: `${i + 1}: …${text.slice(Math.max(0, p - 12), p + phrase.trim().length + 12)}…`,
            }))}
            onChange={(v) => setOccurrence(Number(v))}
          />
        ) : null}
        <Line label={w.ru} value={ru} onChange={setRu} compact />
        <Line label={w.definition} value={definition} onChange={setDefinition} compact />
        <Line label={w.example} value={example} onChange={setExample} compact />
        <Pair label={w.explain} value={note} onChange={setNote} compact />
        <Pick
          label={w.level}
          value={level}
          options={[{ value: "" as const, label: `${w.levelChapter} (${cefr})` }, ...CEFR_LEVELS.map((l) => ({ value: l, label: l }))]}
          onChange={(v) => setLevel(v as Cefr | "")}
        />
        <label className="font-caption text-caption text-on-surface-variant flex items-center gap-2">
          <input type="checkbox" checked={answer} onChange={(e) => setAnswer(e.target.checked)} />
          {w.answer}
        </label>
        <button
          type="button"
          data-action="add-gloss"
          disabled={!ready}
          onClick={add}
          className="font-label-md text-label-md text-primary hover:bg-surface-container-high rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-50"
        >
          {w.add}
        </button>
        {phrase.trim() && places.length && !ru.trim() ? (
          <span className="font-caption text-caption text-text-muted">{w.noTranslation}</span>
        ) : null}
      </div>
    </div>
  );
}

function RemoveButtonLabelled({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="text-on-surface-variant hover:text-status-error shrink-0 rounded p-1 transition-colors"
    >
      <Icon name="delete" className="text-[16px]" />
    </button>
  );
}
