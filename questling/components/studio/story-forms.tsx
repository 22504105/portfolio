"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { itemById, items } from "@/lib/content/items";
import type { Text } from "@/lib/content/text";
import { useStudio } from "@/lib/client/studio";
import type { CampaignKeys, Clue, Scene, SearchScene, TalkScene } from "@/lib/story/graph";
import { SCENE_IMAGES } from "@/lib/story/schema";
import { Upload } from "./dubbing-screen";

// The builder's forms for the story scenes of features gate E: a talk with a character (lines and the
// student's responses), a search in a picture (spots drawn on the picture itself, right ones kept in
// the keys), and a voice-acting scene from the teacher's own published ones. Same fields and look as
// the inspector's other forms (18_quest_builder).

type Edit = (fn: (s: Scene, keys: CampaignKeys) => void) => void;

const field =
  "w-full bg-surface-container text-text-ivory font-body-md text-body-md px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary shadow-sm";
const small =
  "w-full bg-surface-container-lowest text-text-ivory font-body-md text-body-md px-2.5 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-primary";
const card = "p-2.5 rounded-lg bg-surface-container flex flex-col gap-2 shadow-sm";

function L({ children }: { children: React.ReactNode }) {
  return <span className="font-label-sm text-label-sm text-text-ivory">{children}</span>;
}
function Input({ label, value, onChange, lang }: { label: string; value: string; onChange: (v: string) => void; lang?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <L>{label}</L>
      <input className={small} lang={lang} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Pair({ label, value, onChange }: { label: string; value: Text; onChange: (v: Text) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <L>{label}</L>
      <div className="grid grid-cols-2 gap-1.5">
        {(["ru", "en"] as const).map((l) => (
          <input
            key={l}
            className={small}
            aria-label={`${label} (${l})`}
            value={value[l]}
            onChange={(e) => onChange({ ...value, [l]: e.target.value })}
          />
        ))}
      </div>
    </div>
  );
}
function ClueField({ value, clues, onChange }: { value?: string; clues: Clue[]; onChange: (v: string | undefined) => void }) {
  const { t, locale } = useStudio();
  return (
    <label className="flex flex-col gap-1">
      <L>{t.builder.fields.clue}</L>
      <select className={small} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{t.builder.fields.noClue}</option>
        {clues.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
const freshId = (prefix: string, used: string[]) => {
  for (let n = used.length + 1; ; n++) if (!used.includes(`${prefix}${n}`)) return `${prefix}${n}`;
};

export function TalkForm({ scene, clues, edit }: { scene: TalkScene; clues: Clue[]; edit: Edit }) {
  const { t } = useStudio();
  const f = t.builder.story;
  const e = (fn: (s: TalkScene) => void) => edit((s) => s.kind === "talk" && fn(s));
  return (
    <div className="flex flex-col gap-3" data-talk-form={scene.id}>
      <Pair label={f.character} value={scene.character.name} onChange={(v) => e((s) => (s.character.name = v))} />
      <label className="flex flex-col gap-1">
        <L>{f.portrait}</L>
        <select className={small} value={scene.character.image} onChange={(ev) => e((s) => (s.character.image = ev.target.value))}>
          {SCENE_IMAGES.map((src) => (
            <option key={src} value={src}>
              {src.split("/").pop()}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="font-caption text-caption text-text-muted">{f.xp}</span>
        <input
          className={`${small} w-20 text-right`}
          type="number"
          min={0}
          max={200}
          value={scene.xp}
          onChange={(ev) => e((s) => (s.xp = Math.max(0, Math.min(200, Number(ev.target.value) || 0))))}
        />
      </label>
      <ClueField value={scene.clue} clues={clues} onChange={(v) => e((s) => (s.clue = v))} />
      <span className="font-caption text-caption text-text-muted">{f.talkNote}</span>
      {scene.lines.map((line, li) => (
        <div key={line.id} className={card} data-talk-line={line.id}>
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-primary">
              {line.id === scene.start ? f.firstLine : f.line} · {line.id}
            </span>
            {line.id !== scene.start ? (
              <button
                type="button"
                aria-label={f.removeLine}
                className="text-text-muted hover:text-status-error"
                onClick={() => e((s) => (s.lines = s.lines.filter((x) => x.id !== line.id)))}
              >
                <Icon name="delete" className="text-[16px]" />
              </button>
            ) : null}
          </div>
          <Input label={f.says} lang="en" value={line.text} onChange={(v) => e((s) => (s.lines[li].text = v))} />
          <Pair label={t.builder.fields.translation} value={line.translation} onChange={(v) => e((s) => (s.lines[li].translation = v))} />
          {line.responses.map((r, ri) => (
            <div key={r.id} className="bg-surface-container-lowest flex flex-col gap-1.5 rounded p-2" data-response={r.id}>
              <Input label={f.answer} lang="en" value={r.text} onChange={(v) => e((s) => (s.lines[li].responses[ri].text = v))} />
              <Pair label={f.gloss} value={r.gloss} onChange={(v) => e((s) => (s.lines[li].responses[ri].gloss = v))} />
              <label className="flex flex-col gap-1">
                <L>{f.leadsTo}</L>
                <select className={small} value={r.to} onChange={(ev) => e((s) => (s.lines[li].responses[ri].to = ev.target.value))}>
                  <option value="end">{f.end}</option>
                  {scene.lines
                    .filter((x) => x.id !== line.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id}: {x.text.slice(0, 40)}
                      </option>
                    ))}
                </select>
              </label>
              <Input
                label={f.requires}
                value={r.when && "flag" in r.when ? r.when.flag : ""}
                onChange={(v) =>
                  e(
                    (s) =>
                      (s.lines[li].responses[ri].when = v.trim()
                        ? {
                            flag: v
                              .trim()
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-"),
                          }
                        : undefined),
                  )
                }
              />
              <Input
                label={f.sets}
                value={(r.set ?? []).join(", ")}
                onChange={(v) =>
                  e((s) => {
                    const flags = v
                      .split(",")
                      .map((x) =>
                        x
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-"),
                      )
                      .filter(Boolean);
                    s.lines[li].responses[ri].set = flags.length ? flags : undefined;
                  })
                }
              />
              <ClueField value={r.clue} clues={clues} onChange={(v) => e((s) => (s.lines[li].responses[ri].clue = v))} />
              {line.responses.length > 1 ? (
                <button
                  type="button"
                  className="font-caption text-caption text-status-error w-fit"
                  onClick={() => e((s) => s.lines[li].responses.splice(ri, 1))}
                >
                  {f.removeAnswer}
                </button>
              ) : null}
            </div>
          ))}
          {line.responses.length < 4 ? (
            <button
              type="button"
              className="font-caption text-caption text-primary w-fit"
              onClick={() =>
                e((s) =>
                  s.lines[li].responses.push({
                    id: freshId(
                      "r",
                      s.lines[li].responses.map((x) => x.id),
                    ),
                    text: "Thank you.",
                    gloss: { ru: "Спасибо.", en: "Thank you." },
                    to: "end",
                  }),
                )
              }
            >
              {f.addAnswer}
            </button>
          ) : null}
        </div>
      ))}
      {scene.lines.length < 12 ? (
        <button
          type="button"
          data-action="add-talk-line"
          className="font-label-md text-label-md text-primary w-fit"
          onClick={() =>
            e((s) =>
              s.lines.push({
                id: freshId(
                  "line",
                  s.lines.map((x) => x.id),
                ),
                text: "…",
                translation: { ru: "…", en: "…" },
                responses: [{ id: "r1", text: "I see.", gloss: { ru: "Понятно.", en: "I see." }, to: "end" }],
              }),
            )
          }
        >
          {f.addLine}
        </button>
      ) : null}
    </div>
  );
}

export function SearchForm({ scene, keys, clues, edit }: { scene: SearchScene; keys: CampaignKeys; clues: Clue[]; edit: Edit }) {
  const { t, locale, facts, link } = useStudio();
  const f = t.builder.story;
  const ownImages = (facts.objects ?? []).filter((o) => o.kind === "image");
  // An app illustration is a path; a teacher's own picture needs a signed link.
  const [remote, setRemote] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (scene.picture.startsWith("/")) return;
    let live = true;
    void link(scene.picture).then((url) => live && setRemote({ id: scene.picture, url }));
    return () => {
      live = false;
    };
  }, [scene.picture, link]);
  const pictureUrl = scene.picture.startsWith("/") ? scene.picture : remote?.id === scene.picture ? remote.url : null;
  const key = keys[scene.id];
  const targets = key?.kind === "search" ? key.targets : [];
  const ordered = key?.kind === "search" ? key.ordered : false;
  const [selected, setSelected] = useState(scene.spots[0]?.id ?? null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const picture = useRef<HTMLDivElement>(null);
  const e = (fn: (s: SearchScene, k: Extract<CampaignKeys[string], { kind: "search" }>) => void) =>
    edit((s, ks) => {
      if (s.kind !== "search") return;
      const k = ks[s.id]?.kind === "search" ? ks[s.id] : (ks[s.id] = { kind: "search", targets: [], ordered: false });
      fn(s, k as Extract<CampaignKeys[string], { kind: "search" }>);
    });
  const point = (ev: React.PointerEvent) => {
    const box = picture.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height)),
    };
  };
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return (
    <div className="flex flex-col gap-3" data-search-form={scene.id}>
      <Input label={f.task} lang="en" value={scene.task} onChange={(v) => e((s) => (s.task = v))} />
      <Pair label={t.builder.fields.translation} value={scene.translation} onChange={(v) => e((s) => (s.translation = v))} />
      <label className="flex flex-col gap-1">
        <L>{f.picture}</L>
        <select className={small} value={scene.picture} onChange={(ev) => e((s) => (s.picture = ev.target.value))}>
          {SCENE_IMAGES.map((src) => (
            <option key={src} value={src}>
              {src.split("/").pop()}
            </option>
          ))}
          {ownImages.map((o) => (
            <option key={o.id} value={o.id}>
              {f.yourImage} · {o.width}×{o.height}
            </option>
          ))}
        </select>
        <span className="font-caption text-caption text-text-muted">{f.ownImage}</span>
      </label>
      <Upload kind="image" label={f.uploadImage} accept="image/png,image/jpeg,image/webp" onDone={(id) => e((s) => (s.picture = id))} />
      <span className="font-caption text-caption text-text-muted">{f.drawNote}</span>
      {/* Drag on the picture to place the selected spot; the preview is phone-sized so small spots show. */}
      <div
        ref={picture}
        className="relative w-full max-w-[360px] touch-none overflow-hidden rounded-lg select-none"
        onPointerDown={(ev) => {
          if (!selected) return;
          // Capture keeps the drag when the finger leaves the picture; some browsers refuse it, which is fine.
          try {
            (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
          } catch {}
          setDrag(point(ev));
        }}
        onPointerUp={(ev) => {
          if (!drag || !selected) return;
          const end = point(ev);
          const x = Math.min(drag.x, end.x);
          const y = Math.min(drag.y, end.y);
          const w = Math.abs(end.x - drag.x);
          const h = Math.abs(end.y - drag.y);
          setDrag(null);
          if (w < 0.02 || h < 0.02) return;
          e((s) => {
            const spot = s.spots.find((x) => x.id === selected);
            if (spot) Object.assign(spot, { x: round(x), y: round(y), w: round(w), h: round(h) });
          });
        }}
        data-search-preview
      >
        <img src={pictureUrl ?? undefined} alt="" className="block w-full" draggable={false} />
        {scene.spots.map((spot) => (
          <span
            key={spot.id}
            className={`absolute rounded border-2 ${targets.includes(spot.id) ? "border-status-success bg-status-success/15" : "border-[#E8E1D5]/70 bg-black/20"} ${spot.id === selected ? "ring-primary ring-2" : ""}`}
            style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: `${spot.w * 100}%`, height: `${spot.h * 100}%` }}
          >
            <span className="font-caption bg-black/60 px-1 text-[10px] text-white">{spot.label}</span>
          </span>
        ))}
      </div>
      <label className="font-caption text-caption text-on-surface-variant flex items-center gap-2">
        <input type="checkbox" checked={ordered} onChange={(ev) => e((_, k) => (k.ordered = ev.target.checked))} />
        {f.ordered}
      </label>
      {scene.spots.map((spot, i) => (
        <div key={spot.id} className={`${card} ${spot.id === selected ? "ring-primary ring-1" : ""}`} data-spot={spot.id}>
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="font-label-sm text-label-sm text-primary" onClick={() => setSelected(spot.id)}>
              {spot.id === selected ? f.drawing : f.draw} · {spot.id}
            </button>
            <label className="font-caption text-caption text-on-surface-variant flex items-center gap-1.5">
              <input
                type="checkbox"
                data-target={spot.id}
                checked={targets.includes(spot.id)}
                onChange={(ev) =>
                  e((_, k) => (k.targets = ev.target.checked ? [...k.targets, spot.id] : k.targets.filter((x) => x !== spot.id)))
                }
              />
              {f.target}
            </label>
          </div>
          <Input label={f.label} lang="en" value={spot.label} onChange={(v) => e((s) => (s.spots[i].label = v))} />
          <Pair label={f.gloss} value={spot.gloss} onChange={(v) => e((s) => (s.spots[i].gloss = v))} />
          <Pair label={f.found} value={spot.found} onChange={(v) => e((s) => (s.spots[i].found = v))} />
          <span className="font-caption text-caption text-text-muted">
            x {Math.round(spot.x * 100)}% · y {Math.round(spot.y * 100)}% · {Math.round(spot.w * 100)}×{Math.round(spot.h * 100)}%
          </span>
          {scene.spots.length > 2 ? (
            <button
              type="button"
              className="font-caption text-caption text-status-error w-fit"
              onClick={() =>
                e((s, k) => {
                  s.spots = s.spots.filter((x) => x.id !== spot.id);
                  k.targets = k.targets.filter((x) => x !== spot.id);
                })
              }
            >
              {f.removeSpot}
            </button>
          ) : null}
        </div>
      ))}
      {scene.spots.length < 10 ? (
        <button
          type="button"
          data-action="add-spot"
          className="font-label-md text-label-md text-primary w-fit"
          onClick={() =>
            e((s) => {
              const id = freshId(
                "spot",
                s.spots.map((x) => x.id),
              );
              s.spots.push({
                id,
                label: "the candle",
                gloss: { ru: "свеча", en: "the candle" },
                x: 0.4,
                y: 0.4,
                w: 0.12,
                h: 0.12,
                found: { ru: "Нашёл!", en: "Found it!" },
              });
              setSelected(id);
            })
          }
        >
          {f.addSpot}
        </button>
      ) : null}
      <Pair label={t.builder.fields.hint} value={scene.hint} onChange={(v) => e((s) => (s.hint = v))} />
      <label className="flex items-center justify-between gap-2">
        <span className="font-caption text-caption text-text-muted">{f.xp}</span>
        <input
          className={`${small} w-20 text-right`}
          type="number"
          min={0}
          max={200}
          value={scene.xp}
          onChange={(ev) => e((s) => (s.xp = Math.max(0, Math.min(200, Number(ev.target.value) || 0))))}
        />
      </label>
      <ClueField value={scene.clue} clues={clues} onChange={(v) => e((s) => (s.clue = v))} />
      <label className="flex flex-col gap-1">
        <L>{f.item}</L>
        <select className={field} value={scene.item ?? ""} onChange={(ev) => e((s) => (s.item = ev.target.value || undefined))}>
          <option value="">{f.noItem}</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name[locale]}
            </option>
          ))}
        </select>
        {scene.item && itemById.get(scene.item) ? <span className="font-caption text-caption text-text-muted">{f.itemNote}</span> : null}
      </label>
    </div>
  );
}

export function DubForm({ scene, clues, edit }: { scene: Extract<Scene, { kind: "dub" }>; clues: Clue[]; edit: Edit }) {
  const { t, facts } = useStudio();
  const f = t.builder.story;
  const own = (facts.dubs ?? []).filter((d) => !d.archivedAt && d.versions.some((v) => v.status === "published"));
  const e = (fn: (s: Extract<Scene, { kind: "dub" }>) => void) => edit((s) => s.kind === "dub" && fn(s));
  return (
    <div className="flex flex-col gap-3" data-dub-form={scene.id}>
      <label className="flex flex-col gap-1">
        <L>{f.exercise}</L>
        <select
          className={field}
          value={scene.exercise}
          onChange={(ev) => e((s) => (s.exercise = ev.target.value))}
          data-field="dub-exercise"
        >
          {own.some((d) => d.slug === scene.exercise) ? null : <option value={scene.exercise}>{f.chooseExercise}</option>}
          {own.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.title}
            </option>
          ))}
        </select>
        {own.length ? null : <span className="font-caption text-caption text-text-muted">{f.noExercises}</span>}
      </label>
      <Input label={f.intro} lang="en" value={scene.text} onChange={(v) => e((s) => (s.text = v))} />
      <Pair label={t.builder.fields.translation} value={scene.translation} onChange={(v) => e((s) => (s.translation = v))} />
      <label className="font-caption text-caption text-on-surface-variant flex items-start gap-2">
        <input
          type="checkbox"
          checked={scene.optional}
          onChange={(ev) => e((s) => (s.optional = ev.target.checked))}
          data-field="dub-optional"
        />
        {f.optional}
      </label>
      <ClueField value={scene.clue} clues={clues} onChange={(v) => e((s) => (s.clue = v))} />
    </div>
  );
}
