"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useStudio, type StorageUsage } from "@/lib/client/studio";
import {
  builtInClip,
  DUB_MODES,
  dubProblems,
  LIMITS,
  RUBRIC,
  SUBTITLES,
  type DubContent,
  type DubExercise,
  type DubLine,
  type DubSubmission,
  type Rubric,
} from "@/lib/dub/model";
import { fill } from "@/lib/i18n";
import { CEFR_LEVELS } from "@/lib/studio/model";
import { useScene } from "@/components/dub/use-scene";
import { StudioShell } from "./studio-shell";

// Teacher Studio's voice acting (lib/dub/model.ts): scenes (a clip with timed lines) and the students'
// recordings to review. No Stitch screen exists for it; it is built from the studio's approved parts
// only — the library's cards and tabs (19), the builder's inspector fields (18) and the analytics
// review panel (20). Videos go straight from the browser to private storage and are checked on the
// server (lib/server/media-store.ts); the demo studio uses the built-in clip and uploads nothing.

const field =
  "w-full bg-surface-container text-text-ivory font-body-md text-body-md px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary shadow-sm";
const card = "p-space-md bg-surface-container rounded-xl shadow-md flex flex-col gap-3";
const secs = (ms: number) => Math.round(ms / 100) / 10;
const msOf = (value: string) => Math.max(0, Math.round(Number(value) * 1000) || 0);
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function DubbingScreen() {
  const { t, facts } = useStudio();
  const d = t.dubbing;
  const [tab, setTab] = useState<"scenes" | "review">("scenes");
  const waiting = (facts.dubSubmissions ?? []).filter((s) => s.status === "submitted");
  return (
    <StudioShell section="dubbing" title={d.title}>
      <div className="gap-space-lg flex flex-col" data-dubbing>
        <div className="flex flex-col gap-1">
          <span className="font-caption text-caption text-primary font-semibold tracking-wider uppercase">{d.kicker}</span>
          <h1 className="font-headline-md text-headline-md text-text-ivory">{d.title}</h1>
          <p className="text-on-surface-variant max-w-3xl">{d.lead}</p>
        </div>
        <div className="gap-space-xs bg-surface-container-lowest flex w-fit rounded-xl p-1" role="tablist">
          {(["scenes", "review"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-tab={id}
              onClick={() => setTab(id)}
              className={`px-space-md py-space-xs font-label-md text-label-md flex items-center gap-1.5 rounded-lg ${tab === id ? "bg-surface-container text-text-ivory shadow-md" : "text-on-surface-variant"}`}
            >
              {d.tabs[id]}
              {id === "review" && waiting.length ? (
                <span className="bg-secondary-container text-secondary-fixed rounded-full px-1.5 text-[11px] font-bold">
                  {waiting.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {tab === "scenes" ? <Scenes /> : <Review waiting={waiting} />}
      </div>
    </StudioShell>
  );
}

function Scenes() {
  const { t, facts, act, objects } = useStudio();
  const d = t.dubbing;
  const scenes = (facts.dubs ?? []).filter((x) => !x.archivedAt);
  const [selected, setSelected] = useState<string | null>(scenes[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const current = scenes.find((s) => s.id === selected) ?? null;

  const create = () =>
    startTransition(async () => {
      const result = await act({ type: "createDub", title: title.trim() || d.newTitle, cefr: "A2" });
      if (result.ok && result.outcome.kind === "ok" && result.outcome.id) {
        setSelected(result.outcome.id);
        setTitle("");
      }
    });

  return (
    <div className="gap-space-lg grid grid-cols-1 items-start lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-3">
        {objects ? <Usage /> : null}
        <div className={card}>
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-text-ivory">{d.newTitle}</span>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </label>
          <button
            type="button"
            data-action="create-dub"
            onClick={create}
            disabled={pending}
            className="text-surface-container-lowest font-label-md text-label-md flex h-10 items-center justify-center rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] font-semibold disabled:opacity-50"
          >
            {d.create}
          </button>
        </div>
        {scenes.length ? (
          <ul className="flex flex-col gap-2">
            {scenes.map((scene) => (
              <li key={scene.id}>
                <SceneCard scene={scene} active={scene.id === selected} onOpen={() => setSelected(scene.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-on-surface-variant">{d.empty}</p>
        )}
      </aside>
      {current ? <Editor key={`${current.id}@${current.versions.at(-1)?.version}`} scene={current} /> : null}
    </div>
  );
}

function SceneCard({ scene, active, onOpen }: { scene: DubExercise; active: boolean; onOpen: () => void }) {
  const { t, facts } = useStudio();
  const d = t.dubbing;
  const latest = scene.versions.at(-1);
  const published = scene.versions.filter((v) => v.status === "published").at(-1);
  const groups = (facts.dubAssignments ?? [])
    .filter((a) => a.exercise === scene.slug)
    .map((a) => facts.groups.find((g) => g.id === a.groupId)?.name)
    .filter(Boolean);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-dub-scene={scene.slug}
      aria-current={active}
      className={`p-space-md flex w-full flex-col gap-1 rounded-xl text-left shadow-md transition-colors ${active ? "bg-surface-container-high ring-primary ring-1" : "bg-surface-container hover:bg-surface-container-high"}`}
    >
      <span className="font-title-sm text-title-sm text-text-ivory">{scene.title}</span>
      <span className="font-caption text-caption text-text-muted">
        CEFR {scene.cefr} · {published ? fill(d.status.published, { n: published.version }) : d.status.draft}
        {published && latest?.status === "draft" ? ` · ${d.status.changed}` : ""}
      </span>
      <span className="font-caption text-caption text-on-surface-variant">
        {groups.length ? fill(d.assigned, { groups: groups.join(", ") }) : d.notAssigned}
      </span>
    </button>
  );
}

function Usage() {
  const { t, objects } = useStudio();
  const d = t.dubbing;
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  useEffect(() => {
    let live = true;
    void objects?.usage().then((u) => live && setUsage(u));
    return () => {
      live = false;
    };
  }, [objects]);
  if (!usage) return null;
  if (!usage.configured) return <p className="font-caption text-caption text-status-error">{d.noStorage}</p>;
  return (
    <div className="p-space-sm bg-surface-container-lowest flex flex-col gap-1 rounded-lg" data-usage>
      <span className="font-label-sm text-label-sm text-primary">{d.usage}</span>
      <span className="font-caption text-caption text-on-surface-variant">
        {fill(d.usageOwn, { used: mb(usage.own.video?.bytes ?? 0), limit: mb(usage.limits.video) })}
      </span>
      <span className="font-caption text-caption text-on-surface-variant">
        {fill(d.usageGlobal, { used: mb(usage.global.bytes), cap: mb(usage.global.cap) })}
      </span>
      {usage.global.warning ? (
        <span className="font-caption text-caption text-status-error">
          {fill(d.usageWarning, { p: Math.round(usage.global.ratio * 100) })}
        </span>
      ) : null}
    </div>
  );
}

function Editor({ scene }: { scene: DubExercise }) {
  const { t, facts, act, link, mode } = useStudio();
  const d = t.dubbing;
  const latest = scene.versions.at(-1)!;
  const [draft, setDraft] = useState<DubContent>(() => structuredClone(latest.content));
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const { video, ...scenePlayer } = useScene(draft, {});
  const own = (facts.objects ?? []).find((o) => o.id === draft.video);
  const problems = dubProblems(draft, own?.durationMs ?? (draft.video.startsWith("demo:") ? undefined : 0));
  const edit = (fn: (c: DubContent) => void) =>
    setDraft((c) => {
      const next = structuredClone(c);
      fn(next);
      return next;
    });

  useEffect(() => {
    let live = true;
    void (async () => {
      const url = builtInClip(draft.video) ?? (await link(draft.video));
      if (live) setVideoUrl(url);
    })();
    return () => {
      live = false;
    };
  }, [draft.video, link]);

  const save = () =>
    new Promise<boolean>((resolve) =>
      startTransition(async () => {
        setMessage(null);
        const result = await act({ type: "saveDub", exerciseId: scene.id, content: draft });
        setServerProblems(result.ok ? [] : (result.problems ?? [result.refusal]));
        if (result.ok) setMessage(d.saved);
        resolve(result.ok);
      }),
    );
  const publish = () =>
    startTransition(async () => {
      setMessage(null);
      const saved = await act({ type: "saveDub", exerciseId: scene.id, content: draft });
      if (!saved.ok) return setServerProblems(saved.problems ?? [saved.refusal]);
      const result = await act({ type: "publishDub", exerciseId: scene.id });
      setServerProblems(result.ok ? [] : (result.problems ?? [result.refusal]));
      if (result.ok) setMessage(d.published);
    });
  const now = () => Math.round((video.current?.currentTime ?? 0) * 1000);

  return (
    <section className="flex min-w-0 flex-col gap-4" data-dub-editor={scene.slug}>
      <div className={card}>
        <h2 className="font-title-sm text-title-sm text-text-ivory">{d.video}</h2>
        <video
          ref={video}
          src={videoUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-lg bg-black"
          data-editor-video
        />
        <p className="font-caption text-caption text-on-surface-variant">
          {draft.video.startsWith("demo:")
            ? d.builtIn
            : own
              ? fill(d.yourVideo, { size: mb(own.size), seconds: secs(own.durationMs ?? 0) })
              : draft.video}
        </p>
        <Upload
          kind="video"
          label={d.upload}
          note={d.uploadNote}
          accept="video/mp4,video/webm"
          onDone={(id, durationMs) =>
            edit((c) => {
              c.video = id;
              c.rights = true;
              c.trim = { start: 0, end: Math.min(durationMs ?? 60_000, 60_000) };
            })
          }
        />
        {mode === "demo" ? <p className="font-caption text-caption text-text-muted">{d.demoUpload}</p> : null}
        <div className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm text-text-ivory">{d.background}</span>
          <p className="font-caption text-caption text-text-muted">{d.backgroundNote}</p>
          {draft.background ? (
            <button
              type="button"
              className="font-label-sm text-label-sm text-status-error w-fit"
              onClick={() => edit((c) => delete c.background)}
            >
              {d.removeBackground}
            </button>
          ) : (
            <Upload
              kind="background"
              label={d.uploadBackground}
              accept="audio/mp4,audio/mpeg,audio/webm,.m4a,.mp3"
              onDone={(id) => edit((c) => (c.background = id))}
            />
          )}
        </div>
        <label className="font-caption text-caption text-on-surface-variant flex items-start gap-2">
          <input type="checkbox" checked={draft.rights} onChange={(e) => edit((c) => (c.rights = e.target.checked))} data-field="rights" />
          {d.rights}
        </label>
      </div>

      <div className={card}>
        <h2 className="font-title-sm text-title-sm text-text-ivory">{d.trim}</h2>
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label={d.trimStart}
            value={draft.trim.start}
            onChange={(v) => edit((c) => (c.trim.start = v))}
            onNow={() => edit((c) => (c.trim.start = now()))}
            nowLabel={d.now}
          />
          <TimeField
            label={d.trimEnd}
            value={draft.trim.end}
            onChange={(v) => edit((c) => (c.trim.end = v))}
            onNow={() => edit((c) => (c.trim.end = now()))}
            nowLabel={d.now}
          />
        </div>
      </div>

      <div className={card}>
        <h2 className="font-title-sm text-title-sm text-text-ivory">{d.speakers}</h2>
        {draft.speakers.map((speaker, i) => (
          <div key={speaker.id} className="flex items-center gap-2">
            <input
              className={field}
              aria-label={d.speakerName}
              value={speaker.name}
              maxLength={40}
              onChange={(e) => edit((c) => (c.speakers[i].name = e.target.value))}
            />
            {draft.speakers.length > 1 ? (
              <button
                type="button"
                aria-label={d.removeSpeaker}
                className="text-on-surface-variant hover:text-status-error p-1"
                onClick={() =>
                  edit((c) => {
                    c.speakers.splice(i, 1);
                    c.lines = c.lines.filter((l) => l.speaker !== speaker.id);
                  })
                }
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            ) : null}
          </div>
        ))}
        {draft.speakers.length < LIMITS.speakers ? (
          <button
            type="button"
            className="font-label-md text-label-md text-primary w-fit"
            onClick={() =>
              edit((c) =>
                c.speakers.push({
                  id: freshId(
                    "s",
                    c.speakers.map((s) => s.id),
                  ),
                  name: `${d.speakerName} ${c.speakers.length + 1}`,
                }),
              )
            }
          >
            {d.addSpeaker}
          </button>
        ) : null}
      </div>

      <div className={card}>
        <h2 className="font-title-sm text-title-sm text-text-ivory">{d.lines}</h2>
        {[...draft.lines]
          .sort((a, b) => a.start - b.start)
          .map((line) => (
            <LineEditor
              key={line.id}
              line={line}
              speakers={draft.speakers}
              onChange={(fn) => edit((c) => fn(c.lines.find((l) => l.id === line.id)!))}
              onRemove={() => edit((c) => (c.lines = c.lines.filter((l) => l.id !== line.id)))}
              onPlay={() => void scenePlayer.playLine(line)}
              now={now}
            />
          ))}
        {draft.lines.length < LIMITS.lines ? (
          <button
            type="button"
            data-action="add-line"
            className="font-label-md text-label-md text-primary w-fit"
            onClick={() =>
              edit((c) => {
                const last = Math.max(c.trim.start, ...c.lines.map((l) => l.end));
                c.lines.push({
                  id: freshId(
                    "l",
                    c.lines.map((l) => l.id),
                  ),
                  speaker: c.speakers[0].id,
                  start: last,
                  end: Math.min(last + 2000, c.trim.end),
                  text: "…",
                  ru: "",
                });
              })
            }
          >
            {d.addLine}
          </button>
        ) : null}
      </div>

      <div className={card}>
        <h2 className="font-title-sm text-title-sm text-text-ivory">{d.settings}</h2>
        <label className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm text-text-ivory">{d.newTitle}</span>
          <input className={field} value={draft.title} maxLength={80} onChange={(e) => edit((c) => (c.title = e.target.value))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm text-text-ivory">{d.description}</span>
          <input
            className={field}
            value={draft.description}
            maxLength={400}
            onChange={(e) => edit((c) => (c.description = e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm text-text-ivory">{d.instructions}</span>
          <textarea
            className={`${field} resize-none`}
            rows={2}
            value={draft.instructions}
            maxLength={400}
            onChange={(e) => edit((c) => (c.instructions = e.target.value))}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-text-ivory">{d.level}</span>
            <select className={field} value={draft.cefr} onChange={(e) => edit((c) => (c.cefr = e.target.value as DubContent["cefr"]))}>
              {CEFR_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-text-ivory">{d.subtitles}</span>
            <select
              className={field}
              value={draft.subtitles}
              onChange={(e) => edit((c) => (c.subtitles = e.target.value as DubContent["subtitles"]))}
            >
              {SUBTITLES.map((s) => (
                <option key={s} value={s}>
                  {t.dubbing.subtitleModes[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-text-ivory">{d.xp}</span>
            <input
              className={field}
              type="number"
              min={0}
              max={LIMITS.xp}
              value={draft.xp}
              onChange={(e) => edit((c) => (c.xp = Math.max(0, Math.min(LIMITS.xp, Number(e.target.value) || 0))))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-text-ivory">{d.submissions}</span>
            <input
              className={field}
              type="number"
              min={1}
              max={LIMITS.submissions}
              value={draft.submissions}
              onChange={(e) => edit((c) => (c.submissions = Math.max(1, Math.min(LIMITS.submissions, Number(e.target.value) || 1))))}
            />
          </label>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="font-label-sm text-label-sm text-text-ivory mb-1">{d.modes}</legend>
          {DUB_MODES.map((m) => (
            <label key={m} className="font-caption text-caption text-on-surface-variant flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.modes.includes(m)}
                data-mode={m}
                onChange={(e) => edit((c) => (c.modes = e.target.checked ? [...new Set([...c.modes, m])] : c.modes.filter((x) => x !== m)))}
              />
              {t.dubbing.modeNames[m]}
            </label>
          ))}
        </fieldset>
      </div>

      <div className={card}>
        {problems.length || serverProblems.length ? (
          <div className="flex flex-col gap-1" data-dub-problems>
            <span className="font-label-sm text-label-sm text-status-error">{d.problems}</span>
            <ul className="font-caption text-caption text-status-error list-disc pl-4">
              {[...new Set([...problems, ...serverProblems])].map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-action="save-dub"
            onClick={() => void save()}
            disabled={pending}
            className="bg-surface-container-high text-text-ivory font-label-md text-label-md rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {d.save}
          </button>
          <button
            type="button"
            data-action="publish-dub"
            onClick={publish}
            disabled={pending || problems.length > 0}
            className="text-surface-container-lowest font-label-md text-label-md rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] px-4 py-2 font-semibold disabled:opacity-50"
          >
            {d.publish}
          </button>
          {message ? (
            <span className="font-caption text-caption text-status-success self-center" role="status">
              {message}
            </span>
          ) : null}
        </div>
        <Assign scene={scene} />
      </div>
    </section>
  );
}

function freshId(prefix: string, used: string[]): string {
  for (let n = used.length + 1; ; n++) if (!used.includes(`${prefix}${n}`)) return `${prefix}${n}`;
}

function TimeField({
  label,
  value,
  onChange,
  onNow,
  nowLabel,
}: {
  label: string;
  value: number;
  onChange: (ms: number) => void;
  onNow: () => void;
  nowLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-text-ivory">{label}</span>
        <input
          className={field}
          type="number"
          step={0.1}
          min={0}
          max={60}
          value={secs(value)}
          onChange={(e) => onChange(msOf(e.target.value))}
        />
      </label>
      <button type="button" onClick={onNow} className="font-caption text-caption text-primary w-fit">
        {nowLabel}
      </button>
    </div>
  );
}

function LineEditor({
  line,
  speakers,
  onChange,
  onRemove,
  onPlay,
  now,
}: {
  line: DubLine;
  speakers: DubContent["speakers"];
  onChange: (fn: (l: DubLine) => void) => void;
  onRemove: () => void;
  onPlay: () => void;
  now: () => number;
}) {
  const { t } = useStudio();
  const d = t.dubbing;
  return (
    <div className="bg-surface-container-lowest flex flex-col gap-2 rounded-lg p-3" data-line-editor={line.id}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-text-ivory">{d.lineSpeaker}</span>
          <select className={field} value={line.speaker} onChange={(e) => onChange((l) => (l.speaker = e.target.value))}>
            {speakers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <TimeField
          label={d.lineStart}
          value={line.start}
          onChange={(v) => onChange((l) => (l.start = v))}
          onNow={() => onChange((l) => (l.start = now()))}
          nowLabel={d.now}
        />
        <TimeField
          label={d.lineEnd}
          value={line.end}
          onChange={(v) => onChange((l) => (l.end = v))}
          onNow={() => onChange((l) => (l.end = now()))}
          nowLabel={d.now}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-text-ivory">{d.lineText}</span>
        <input
          className={field}
          lang="en"
          value={line.text}
          maxLength={LIMITS.text}
          onChange={(e) => onChange((l) => (l.text = e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-text-ivory">{d.lineRu}</span>
        <input
          className={field}
          lang="ru"
          value={line.ru}
          maxLength={LIMITS.text}
          onChange={(e) => onChange((l) => (l.ru = e.target.value))}
        />
      </label>
      <div className="flex gap-3">
        <button type="button" onClick={onPlay} className="font-label-sm text-label-sm text-primary flex items-center gap-1">
          <Icon name="play_arrow" className="text-[18px]" /> {d.playLine}
        </button>
        <button type="button" onClick={onRemove} className="font-label-sm text-label-sm text-status-error flex items-center gap-1">
          <Icon name="delete" className="text-[18px]" /> {d.removeLine}
        </button>
      </div>
    </div>
  );
}

export function Upload({
  kind,
  label,
  note,
  accept,
  onDone,
}: {
  kind: "video" | "background" | "image";
  label: string;
  note?: string;
  accept: string;
  onDone: (id: string, durationMs: number | null) => void;
}) {
  const { t, objects } = useStudio();
  const d = t.dubbing;
  const input = useRef<HTMLInputElement>(null);
  const [rights, setRights] = useState(false);
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!objects) return null;
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!rights) return setError(d.rightsNeeded);
    setState("busy");
    setError(null);
    const result = await objects.upload(kind, file, rights);
    setState("idle");
    if (input.current) input.current.value = "";
    if (!result.ok) return setError(fill(d.uploadFailed, { reason: d.reasons[result.reason as keyof typeof d.reasons] ?? result.reason }));
    onDone(result.id, result.durationMs);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {note ? <p className="font-caption text-caption text-text-muted">{note}</p> : null}
      <label className="font-caption text-caption text-on-surface-variant flex items-start gap-2">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} data-field={`rights-${kind}`} />
        {d.rights}
      </label>
      <label className="bg-surface-container-high text-text-ivory font-label-md text-label-md flex w-fit cursor-pointer items-center gap-2 rounded-lg px-4 py-2">
        <Icon name="upload" className="text-primary text-[18px]" />
        {state === "busy" ? d.uploading : label}
        <input
          ref={input}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={state === "busy"}
          onChange={(e) => void pick(e.target.files?.[0])}
          data-upload={kind}
        />
      </label>
      {error ? (
        <p className="font-caption text-caption text-status-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Assign({ scene }: { scene: DubExercise }) {
  const { t, facts, act } = useStudio();
  const d = t.dubbing;
  const groups = facts.groups.filter((g) => !g.archivedAt);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const published = scene.versions.some((v) => v.status === "published");
  const assignments = (facts.dubAssignments ?? []).filter((a) => a.exercise === scene.slug);
  if (!published || !groups.length) return null;
  return (
    <div className="border-surface-container-high flex flex-col gap-2 border-t pt-3">
      <span className="font-label-sm text-label-sm text-text-ivory">{d.assign}</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select className={field} aria-label={d.assignGroup} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input className={field} type="datetime-local" aria-label={d.dueAt} value={due} onChange={(e) => setDue(e.target.value)} />
        <button
          type="button"
          data-action="assign-dub"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await act({
                type: "assignDub",
                groupId,
                exerciseId: scene.id,
                dueAt: due ? new Date(due).toISOString() : null,
              });
              setDone(result.ok);
            })
          }
          className="bg-surface-container-high text-text-ivory font-label-md text-label-md rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {done ? d.assignDone : d.assign}
        </button>
      </div>
      {assignments.map((a) => (
        <div key={a.id} className="font-caption text-caption text-on-surface-variant flex items-center justify-between gap-2">
          <span>
            {facts.groups.find((g) => g.id === a.groupId)?.name} · v{a.version}
          </span>
          <button
            type="button"
            className="text-status-error"
            onClick={() => startTransition(async () => void (await act({ type: "unassignDub", assignmentId: a.id })))}
          >
            {d.unassign}
          </button>
        </div>
      ))}
    </div>
  );
}

function Review({ waiting }: { waiting: DubSubmission[] }) {
  const { t } = useStudio();
  const [open, setOpen] = useState<string | null>(waiting[0]?.id ?? null);
  // The reviewed submission leaves the queue at once; the answer is confirmed here, above it.
  const [answered, setAnswered] = useState(false);
  const current = waiting.find((s) => s.id === open) ?? waiting[0] ?? null;
  const confirmation = answered ? (
    <p className="font-caption text-caption text-status-success" role="status">
      {t.dubbing.reviewed}
    </p>
  ) : null;
  if (!waiting.length)
    return (
      <div className="flex flex-col gap-2">
        {confirmation}
        <p className="text-on-surface-variant">{t.dubbing.reviewEmpty}</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {confirmation}
      <div className="gap-space-lg grid grid-cols-1 items-start lg:grid-cols-[320px_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2">
          {waiting.map((s) => (
            <li key={s.id}>
              <SubmissionCard submission={s} active={s.id === current?.id} onOpen={() => (setOpen(s.id), setAnswered(false))} />
            </li>
          ))}
        </ul>
        {current ? <ReviewPanel key={current.id} submission={current} onAnswered={() => setAnswered(true)} /> : null}
      </div>
    </div>
  );
}

function SubmissionCard({ submission, active, onOpen }: { submission: DubSubmission; active: boolean; onOpen: () => void }) {
  const { t, facts, locale } = useStudio();
  const member = facts.members.find((m) => m.userId === submission.userId);
  const scene = (facts.dubs ?? []).find((d) => d.slug === submission.exercise);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-submission={submission.id}
      className={`p-space-md flex w-full flex-col gap-1 rounded-xl text-left shadow-md ${active ? "bg-surface-container-high ring-primary ring-1" : "bg-surface-container"}`}
    >
      <span className="font-title-sm text-title-sm text-text-ivory">{member?.heroName ?? member?.username ?? "—"}</span>
      <span className="font-caption text-caption text-text-muted">{scene?.title}</span>
      {submission.submittedAt ? (
        <span className="font-caption text-caption text-on-surface-variant">
          {fill(t.dubbing.submittedAt, { when: new Date(submission.submittedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB") })}
        </span>
      ) : null}
    </button>
  );
}

function ReviewPanel({ submission, onAnswered }: { submission: DubSubmission; onAnswered: () => void }) {
  const { t, facts, act, link } = useStudio();
  const d = t.dubbing;
  const exercise = (facts.dubs ?? []).find((x) => x.slug === submission.exercise);
  const content = exercise?.versions.find((v) => v.version === submission.version)?.content;
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [takes, setTakes] = useState<Map<string, string>>(new Map());
  const [rubric, setRubric] = useState<Rubric>({});
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const latestTake = useMemo(() => {
    const ids = new Map<string, string>();
    for (const take of [...submission.takes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) ids.set(take.lineId, take.mediaId);
    return ids;
  }, [submission.takes]);

  useEffect(() => {
    if (!content) return;
    let live = true;
    void (async () => {
      const get = async (id: string) => builtInClip(id) ?? (await link(id));
      const v = await get(content.video);
      const b = content.background ? await get(content.background) : null;
      const urls = new Map<string, string>();
      for (const [line, id] of latestTake) {
        const url = await get(id);
        if (url) urls.set(line, url);
      }
      if (!live) return;
      setVideoUrl(v);
      setBackground(b);
      setTakes(urls);
    })();
    return () => {
      live = false;
    };
  }, [content, latestTake, link]);

  const { video, ...player } = useScene(content ?? ({ lines: [], trim: { start: 0, end: 0 } } as unknown as DubContent), {
    takes,
    background,
    role: submission.role,
  });
  if (!content) return null;
  const member = facts.members.find((m) => m.userId === submission.userId);
  const role = content.speakers.find((s) => s.id === submission.role)?.name ?? submission.role;
  const decide = (decision: "approve" | "retry") =>
    startTransition(async () => {
      const result = await act({ type: "reviewDub", submissionId: submission.id, decision, feedback, rubric });
      setSent(result.ok);
      if (result.ok) onAnswered();
    });

  return (
    <section className="flex min-w-0 flex-col gap-4" data-review-panel={submission.id}>
      <div className={card}>
        <h2 className="font-title-sm text-title-sm text-text-ivory">
          {member?.heroName ?? member?.username} · {exercise?.title}
        </h2>
        <p className="font-caption text-caption text-on-surface-variant">
          {fill(d.role, { role, mode: t.dubbing.modeNames[submission.mode] })} ·{" "}
          {fill(d.attempt, { n: submission.attempts, total: content.submissions })}
        </p>
        <p className="font-caption text-caption text-text-muted">{d.reviewLead}</p>
        <video ref={video} src={videoUrl ?? undefined} playsInline preload="auto" className="aspect-video w-full rounded-lg bg-black" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="bg-surface-container-high text-text-ivory font-label-md text-label-md rounded-lg px-4 py-2"
            onClick={() => void player.playScene(false)}
          >
            {d.playOriginal}
          </button>
          <button
            type="button"
            data-action="play-student"
            className="bg-surface-container-high text-text-ivory font-label-md text-label-md rounded-lg px-4 py-2"
            onClick={() => void player.playScene(true)}
          >
            {d.playStudent}
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {content.lines
            .filter((l) => latestTake.has(l.id))
            .map((line) => (
              <li key={line.id} className="bg-surface-container-lowest flex flex-col gap-1.5 rounded-lg p-3">
                <span lang="en" className="text-text-ivory">
                  {line.text}
                </span>
                <span className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="font-label-sm text-label-sm text-primary flex items-center gap-1"
                    onClick={() => void player.playLine(line)}
                  >
                    <Icon name="play_arrow" className="text-[18px]" /> {d.lineOriginal}
                  </button>
                  <button
                    type="button"
                    className="font-label-sm text-label-sm text-secondary flex items-center gap-1 disabled:opacity-40"
                    disabled={!takes.get(line.id)}
                    onClick={() => void new Audio(takes.get(line.id)!).play()}
                  >
                    <Icon name="mic" className="text-[18px]" /> {d.lineTake}
                  </button>
                </span>
              </li>
            ))}
        </ul>
      </div>
      <div className={card}>
        <span className="font-label-sm text-label-sm text-text-ivory">{d.rubric}</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RUBRIC.map((item) => (
            <div key={item} className="flex items-center justify-between gap-2" role="radiogroup" aria-label={t.dubbing.rubricNames[item]}>
              <span className="font-caption text-caption text-on-surface-variant">{t.dubbing.rubricNames[item]}</span>
              <span className="flex gap-1">
                {(["good", "work"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rubric[item] === value}
                    data-rubric={`${item}-${value}`}
                    onClick={() => setRubric((r) => ({ ...r, [item]: r[item] === value ? undefined : value }))}
                    className={`font-label-sm text-label-sm rounded-full px-2.5 py-1 ${rubric[item] === value ? (value === "good" ? "bg-status-success/25 text-status-success" : "bg-status-error/20 text-status-error") : "bg-surface-container-high text-text-ivory"}`}
                  >
                    {value === "good" ? d.rubricGood : d.rubricWork}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm text-text-ivory">{d.feedback}</span>
          <textarea
            className={`${field} resize-none`}
            rows={3}
            maxLength={1000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-action="approve-dub"
            disabled={pending || sent}
            onClick={() => decide("approve")}
            className="text-surface-container-lowest font-label-md text-label-md rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] px-4 py-2 font-semibold disabled:opacity-50"
          >
            {fill(d.approve, { xp: content.xp })}
          </button>
          <button
            type="button"
            data-action="retry-dub"
            disabled={pending || sent}
            onClick={() => decide("retry")}
            className="bg-surface-container-high text-text-ivory font-label-md text-label-md rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {d.retry}
          </button>
          {sent ? (
            <span className="font-caption text-caption text-status-success self-center" role="status">
              {d.reviewed}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
