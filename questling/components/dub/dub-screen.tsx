"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useStudent } from "@/lib/client/student";
import { startRecording, recordingFormat, type RecorderProblem, type Take } from "@/lib/client/recorder";
import {
  builtInClip,
  latestTakes,
  RUBRIC,
  roleLines,
  SUBMITTED_MODES,
  type AssignedDub,
  type DubLine,
  type DubMode,
  type DubSubmission,
  type Subtitles,
} from "@/lib/dub/model";
import { worldOf } from "@/lib/game/world";
import { fill } from "@/lib/i18n";
import { glossViews } from "@/lib/learning/gloss";
import { BackHeader } from "@/components/student/back-header";
import { GlossedText } from "@/components/student/glossed-text";
import { useScene } from "./use-scene";
import { takeReason } from "@/lib/client/take-upload";

// Voice acting, the student's side (lib/dub/model.ts). No Stitch screen exists for it: it is put
// together from approved parts only — the story player's header, scene card, option rows and gold
// button (05), the puzzle chamber's feedback banner (06), the discovery card (09) and the quests'
// filter chips (08). The video is the teacher's (or the built-in scene); the student's takes stay in
// this browser until they press "Keep", which uploads that one take (lib/server/media-store.ts).

const RATES = [1, 0.75, 0.5] as const;
const AFTER_LINE_MS = 800;

export function DubScreen({ exercise }: { exercise: string }) {
  const { t, base, facts } = useStudent();
  const assigned = worldOf(facts).dubs?.find((d) => d.exercise === exercise);
  if (!assigned)
    return (
      <div className="bg-background min-h-dvh">
        <BackHeader title={t.dub.title} backHref={`${base}/quests`} profileHref={`${base}/profile`} t={t} />
        <p className="px-margin text-on-surface-variant pt-24 text-center">{t.dub.empty}</p>
      </div>
    );
  return <SceneView key={`${assigned.exercise}@${assigned.version}`} assigned={assigned} />;
}

function SceneView({ assigned }: { assigned: AssignedDub }) {
  const { t, base, facts, act, mode, media } = useStudent();
  const exercise = assigned.exercise;
  {
    const { content, version } = assigned;
    const submission = facts.dubs?.find((d) => d.exercise === exercise && d.version === version) ?? null;
    const speakers = content.speakers;
    const offered = content.modes.filter((m): m is Exclude<DubMode, "shadowing"> => SUBMITTED_MODES.includes(m));
    const [role, setRole] = useState(submission?.role ?? (speakers.length === 1 ? speakers[0].id : (speakers.at(-1)?.id ?? "")));
    const [chosen, setChosen] = useState<Exclude<DubMode, "shadowing">>(submission?.mode ?? offered[0] ?? "listen");
    const subtitleChoices: Subtitles[] =
      content.subtitles === "none" ? ["none"] : content.subtitles === "en" ? ["en", "none"] : ["en_ru", "en", "none"];
    const [subtitles, setSubtitles] = useState<Subtitles>(subtitleChoices[0]);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
    const [videoFailed, setVideoFailed] = useState(false);
    const [savedUrls, setSavedUrls] = useState<Map<string, string>>(new Map());
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const started = submission !== null;
    const lines = roleLines(content, role, chosen);
    const latest = submission ? latestTakes(content, submission) : null;
    const keptTakes = submission?.takes;
    const savedTakeIds = useMemo(() => {
      const ids = new Map<string, string>();
      for (const take of [...(keptTakes ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) ids.set(take.lineId, take.mediaId);
      return ids;
    }, [keptTakes]);

    // Links: the scene's video and background (built-in files, or signed links), and the kept takes.
    useEffect(() => {
      let live = true;
      void (async () => {
        const link = async (ref: string) => builtInClip(ref) ?? (await media.link(ref));
        const v = await link(content.video);
        if (!live) return;
        if (v) setVideoUrl(v);
        else setVideoFailed(true);
        if (content.background) {
          const b = await link(content.background);
          if (live) setBackgroundUrl(b);
        }
      })();
      return () => {
        live = false;
      };
    }, [content.video, content.background, media]);

    useEffect(() => {
      let live = true;
      void (async () => {
        const urls = new Map<string, string>();
        for (const [line, id] of savedTakeIds) {
          const url = await media.link(id);
          if (url) urls.set(line, url);
        }
        if (live) setSavedUrls(urls);
      })();
      return () => {
        live = false;
      };
    }, [savedTakeIds, media]);

    const { video, ...scene } = useScene(content, { takes: savedUrls, background: backgroundUrl, role });
    const editable = !submission || submission.status === "recording" || submission.status === "retry";
    const canSubmit = !!submission && editable && !!latest && submission.attempts < content.submissions;

    const begin = () =>
      startTransition(async () => {
        setError(null);
        const result = await act({ type: "startDub", exercise, role, mode: chosen });
        if (!result.ok) setError(t.common.actionFailed);
      });
    const submit = () =>
      startTransition(async () => {
        setError(null);
        const result = await act({ type: "submitDub", exercise });
        if (!result.ok) setError(t.common.actionFailed);
      });

    return (
      <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased" data-dub={exercise}>
        <BackHeader title={t.dub.title} backHref={`${base}/quests`} profileHref={`${base}/profile`} t={t} />
        <main className="pb-safe px-margin mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-5 pt-20 pb-10">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase">
              {t.dub.list} · CEFR {content.cefr}
            </span>
            <h1 className="font-headline-md text-headline-md text-text-ivory">{content.title}</h1>
            {content.description ? <p className="text-on-surface-variant">{content.description}</p> : null}
          </div>

          <div className="overflow-hidden rounded-xl bg-black shadow-[0_12px_32px_rgba(0,0,0,0.7)]">
            {videoFailed ? (
              <p className="p-space-md text-status-error aspect-video">{t.dub.videoFailed}</p>
            ) : (
              <video
                ref={video}
                src={videoUrl ?? undefined}
                playsInline
                preload="auto"
                className="aspect-video w-full"
                onError={() => setVideoFailed(true)}
                data-scene-video
              />
            )}
            {subtitles !== "none" ? (
              <div className="bg-surface-container-lowest min-h-14 px-3 py-2" aria-live="polite" data-subtitles>
                {scene.current.map((line) => (
                  <p key={line.id} className="text-center">
                    <span className="text-primary font-label-sm text-label-sm">{speakers.find((s) => s.id === line.speaker)?.name}: </span>
                    <span lang="en" className="text-text-ivory">
                      {line.text}
                    </span>
                    {subtitles === "en_ru" && line.ru ? (
                      <span lang="ru" className="text-text-muted font-caption text-caption block">
                        {line.ru}
                      </span>
                    ) : null}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          {subtitleChoices.length > 1 ? (
            <Chips
              label={t.dub.subtitles}
              value={subtitles}
              options={subtitleChoices.map((s) => ({ id: s, label: t.dub.subtitleModes[s] }))}
              onChange={(v) => setSubtitles(v as Subtitles)}
            />
          ) : null}

          {mode === "demo" ? <p className="font-caption text-caption text-text-muted">{t.dub.demoNote}</p> : null}

          {submission ? <StatusCard submission={submission} xp={content.xp} /> : null}

          {!started ? (
            <section className="bg-surface-container-low p-space-md flex flex-col gap-3 rounded-lg shadow-inner" data-dub-setup>
              {content.instructions ? <p className="text-text-ivory">{content.instructions}</p> : null}
              {speakers.length > 1 ? (
                <Chips label={t.dub.role} value={role} options={speakers.map((s) => ({ id: s.id, label: s.name }))} onChange={setRole} />
              ) : null}
              <Chips
                label={t.dub.mode}
                value={chosen}
                options={offered.map((m) => ({ id: m, label: t.dub.modes[m] }))}
                onChange={(v) => setChosen(v as Exclude<DubMode, "shadowing">)}
              />
              <p className="font-caption text-caption text-on-surface-variant">{t.dub.modeNotes[chosen]}</p>
              <GoldButton label={t.dub.start} onClick={begin} busy={pending} action="start-dub" />
            </section>
          ) : (
            <>
              <section className="flex flex-col gap-3" data-dub-lines>
                <h2 className="font-title-sm text-title-sm text-text-ivory flex items-center justify-between">
                  <span>{t.dub.lines}</span>
                  <span className="font-caption text-caption text-text-muted">
                    {speakers.find((s) => s.id === role)?.name} · {t.dub.modes[chosen]}
                  </span>
                </h2>
                {lines.map((line, i) => (
                  <LineCard
                    key={line.id}
                    line={line}
                    n={i + 1}
                    total={lines.length}
                    withVideo={chosen !== "listen"}
                    editable={editable}
                    savedUrl={savedUrls.get(line.id) ?? null}
                    scene={scene}
                    subtitles={subtitles}
                    exercise={exercise}
                  />
                ))}
              </section>

              <PreviewCard mine={!!latest && savedUrls.size >= lines.length} scene={scene} />

              {editable ? (
                <section className="flex flex-col gap-2">
                  <GoldButton label={t.dub.submit} onClick={submit} busy={pending} disabled={!canSubmit} action="submit-dub" />
                  <p className="font-caption text-caption text-text-muted text-center">
                    {!latest
                      ? t.dub.submitNeeds
                      : submission!.attempts >= content.submissions
                        ? t.dub.noAttempts
                        : fill(t.dub.attempts, { used: submission!.attempts, total: content.submissions })}
                  </p>
                </section>
              ) : null}
            </>
          )}
          {error ? (
            <p className="font-caption text-caption text-status-error" role="alert">
              {error}
            </p>
          ) : null}

          {content.modes.includes("shadowing") ? <ShadowingCard lines={content.lines} scene={scene} /> : null}
        </main>
      </div>
    );
  }
}

function StatusCard({ submission: s, xp }: { submission: DubSubmission; xp: number }) {
  const { t } = useStudent();
  const tone =
    s.status === "approved"
      ? "bg-status-success/15 text-status-success"
      : s.status === "retry"
        ? "bg-status-error/15 text-status-error"
        : "bg-secondary-container/30 text-secondary";
  return (
    <section className={`p-space-md flex flex-col gap-2 rounded-xl ${tone}`} data-dub-status={s.status}>
      <span className="font-label-md text-label-md">
        {s.status === "approved" ? fill(t.dub.approved, { xp }) : t.dub.statuses[s.status]}
      </span>
      {s.status === "submitted" ? <span className="font-caption text-caption">{t.dub.submittedNote}</span> : null}
      {s.status === "retry" ? <span className="font-caption text-caption">{t.dub.retryNote}</span> : null}
      {s.feedback ? (
        <div className="bg-surface/60 text-on-surface rounded-lg p-2.5">
          <span className="font-label-sm text-label-sm text-primary block">{t.dub.feedback}</span>
          <p className="whitespace-pre-line">{s.feedback}</p>
        </div>
      ) : null}
      {s.rubric ? (
        <ul className="flex flex-wrap gap-1.5">
          {RUBRIC.filter((k) => s.rubric?.[k]).map((k) => (
            <li key={k} className="bg-surface text-on-surface font-caption text-caption rounded-full px-2.5 py-1">
              {t.dub.rubric[k]}: {s.rubric![k] === "good" ? t.dub.rubricGood : t.dub.rubricWork}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PreviewCard({ mine, scene }: { mine: boolean; scene: SceneApi }) {
  const { t } = useStudent();
  const [which, setWhich] = useState<"original" | "mine">("original");
  const playing = scene.playing?.kind === "scene";
  return (
    <section className="bg-surface-container-low p-space-md flex flex-col gap-3 rounded-lg shadow-inner" data-dub-preview>
      <h2 className="font-title-sm text-title-sm text-text-ivory">{t.dub.preview}</h2>
      <Chips
        label={t.dub.preview}
        hideLabel
        value={which}
        options={[
          { id: "original", label: t.dub.previewOriginal },
          { id: "mine", label: t.dub.previewMine, disabled: !mine },
        ]}
        onChange={(v) => {
          setWhich(v as "original" | "mine");
          if (playing) void scene.playScene(v === "mine");
        }}
      />
      {!mine ? <p className="font-caption text-caption text-text-muted">{t.dub.previewMissing}</p> : null}
      {which === "mine" ? <p className="font-caption text-caption text-text-muted">{t.dub.muteNote}</p> : null}
      <button
        type="button"
        data-action="play-scene"
        onClick={() => (playing ? scene.stop() : void scene.playScene(which === "mine"))}
        className="bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md flex h-11 items-center justify-center gap-2 rounded-lg shadow-xs"
      >
        <Icon name={playing ? "stop" : "play_arrow"} className="text-primary text-[20px]" /> {playing ? t.dub.pause : t.dub.play}
      </button>
    </section>
  );
}

function ShadowingCard({ lines, scene }: { lines: DubLine[]; scene: SceneApi }) {
  const { t } = useStudent();
  const [problem, setProblem] = useState<RecorderProblem | null>(null);
  const [takes, setTakes] = useState<Record<string, Take>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const practise = async (line: DubLine, together: boolean) => {
    setProblem(null);
    setBusy(line.id);
    const length = line.end - line.start;
    if (!together) {
      await scene.playLine(line);
      await new Promise((r) => setTimeout(r, length + 200));
    }
    const start = await startRecording(length + (together ? 600 : 1500));
    if (!start.ok) {
      setProblem(start.problem);
      setBusy(null);
      return;
    }
    if (together) void scene.playLine(line);
    const done = await start.recording.done;
    setBusy(null);
    if (done.ok) setTakes((all) => ({ ...all, [line.id]: done.take }));
    else setProblem(done.problem);
  };
  return (
    <details className="bg-surface-container-low p-space-md group flex flex-col gap-3 rounded-lg shadow-inner" data-shadowing>
      <summary className="font-title-sm text-title-sm text-text-ivory flex cursor-pointer list-none items-center justify-between">
        {t.dub.modes.shadowing}
        <Icon name="expand_more" className="text-primary text-[22px] transition-transform group-open:rotate-180" />
      </summary>
      <p className="font-caption text-caption text-on-surface-variant">{t.dub.modeNotes.shadowing}</p>
      <p className="font-caption text-caption text-text-muted">{t.dub.shadowNote}</p>
      {problem ? <p className="font-caption text-caption text-status-error">{t.dub.problems[problem]}</p> : null}
      {[...lines]
        .sort((a, b) => a.start - b.start)
        .map((line) => (
          <div key={line.id} className="bg-surface flex flex-col gap-2 rounded-lg p-3">
            <span lang="en" className="text-text-ivory">
              {line.text}
            </span>
            <div className="flex flex-wrap gap-2">
              <SmallButton icon="graphic_eq" label={t.dub.shadowTogether} disabled={!!busy} onClick={() => practise(line, true)} />
              <SmallButton icon="replay" label={t.dub.shadowAfter} disabled={!!busy} onClick={() => practise(line, false)} />
              {takes[line.id] ? (
                <SmallButton
                  icon="play_arrow"
                  label={fill(t.dub.listen, { n: 1 })}
                  onClick={() => void new Audio(takes[line.id].url).play()}
                />
              ) : null}
            </div>
          </div>
        ))}
    </details>
  );
}

type SceneApi = Omit<ReturnType<typeof useScene>, "video">;

function LineCard({
  line,
  n,
  total,
  withVideo,
  editable,
  savedUrl,
  scene,
  subtitles,
  exercise,
}: {
  exercise: string;
  line: DubLine;
  n: number;
  total: number;
  withVideo: boolean;
  editable: boolean;
  savedUrl: string | null;
  scene: SceneApi;
  subtitles: Subtitles;
}) {
  const { t, locale, media } = useStudent();
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const [takes, setTakes] = useState<Take[]>([]);
  const [problem, setProblem] = useState<RecorderProblem | null>(null);
  const [state, setState] = useState<"idle" | "countdown" | "recording">("idle");
  const [count, setCount] = useState(3);
  const [keeping, setKeeping] = useState<number | null>(null);
  const [kept, setKept] = useState<number | null>(null);
  const [keepError, setKeepError] = useState<string | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const glosses = glossViews(line.glosses, () => line.text, { locale, cefr: "A1" });
  const supported = typeof window !== "undefined" && recordingFormat() !== null;

  const record = async () => {
    setProblem(null);
    setKept(null);
    setState("countdown");
    for (let i = 3; i > 0; i--) {
      setCount(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    const length = line.end - line.start;
    const start = await startRecording(withVideo ? length + AFTER_LINE_MS : length * 2 + 2000);
    if (!start.ok) {
      setProblem(start.problem);
      setState("idle");
      return;
    }
    setState("recording");
    stopRef.current = start.recording.stop;
    // Voice-over and role-play: the scene plays this line silently while the student speaks it.
    if (withVideo) void scene.playLine(line, 1, true);
    const done = await start.recording.done;
    scene.stop();
    setState("idle");
    if (done.ok) setTakes((all) => [...all, done.take]);
    else setProblem(done.problem);
  };

  const keep = async (i: number) => {
    setKeeping(i);
    setKeepError(null);
    const take = takes[i];
    const result = await media.uploadTake(exercise, line.id, { blob: take.blob, mime: take.mime });
    setKeeping(null);
    if (result.ok) setKept(i);
    else setKeepError(fill(t.dub.keepFailed, { reason: t.dub.keepReasons[takeReason(result.reason)] }));
  };

  return (
    <article className="bg-surface-container-low p-space-md flex flex-col gap-3 rounded-lg shadow-xs" data-line={line.id}>
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase">{fill(t.dub.line, { n, total })}</span>
        {savedUrl ? (
          <span className="font-caption text-caption text-status-success flex items-center gap-1" data-saved>
            <Icon name="check_circle" className="text-[14px]" /> {t.dub.kept}
          </span>
        ) : null}
      </div>
      <p lang="en" className="font-georgia text-title-sm text-text-ivory italic">
        “<GlossedText text={line.text} glosses={glosses} />”
      </p>
      {subtitles === "en_ru" && line.ru ? (
        <p lang="ru" className="font-caption text-caption text-text-muted -mt-2">
          {line.ru}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <SmallButton icon="play_arrow" label={t.dub.original} action="play-original" onClick={() => void scene.playLine(line, rate)} />
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t.dub.speed}>
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={rate === r}
              onClick={() => setRate(r)}
              className={`font-label-sm text-label-sm rounded-full px-2.5 py-1 ${rate === r ? "bg-primary text-on-primary" : "bg-surface-container-high text-text-ivory"}`}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>
      {editable ? (
        !supported ? (
          <p className="font-caption text-caption text-status-error">{t.dub.problems.unsupported}</p>
        ) : (
          <>
            {state === "idle" ? (
              <button
                type="button"
                data-action="record"
                onClick={record}
                className="bg-status-error/15 text-status-error font-label-md text-label-md flex h-11 items-center justify-center gap-2 rounded-lg"
              >
                <Icon name="mic" className="text-[20px]" /> {t.dub.record}
              </button>
            ) : state === "countdown" ? (
              <p className="font-label-md text-label-md text-primary text-center" role="status">
                {fill(t.dub.countdown, { n: count })}
              </p>
            ) : (
              <button
                type="button"
                data-action="stop"
                onClick={() => stopRef.current()}
                className="bg-status-error text-surface font-label-md text-label-md flex h-11 items-center justify-center gap-2 rounded-lg motion-safe:animate-pulse"
              >
                <Icon name="stop" className="text-[20px]" /> {t.dub.recording} {t.dub.stop}
              </button>
            )}
            {problem ? (
              <p className="font-caption text-caption text-status-error" role="alert">
                {t.dub.problems[problem]}
              </p>
            ) : null}
          </>
        )
      ) : null}
      {takes.length || savedUrl ? (
        <ul className="flex flex-col gap-1.5" aria-label={t.dub.takes}>
          {savedUrl ? (
            <li className="bg-surface flex items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="font-caption text-caption text-text-ivory">{t.dub.savedTake}</span>
              <SmallButton icon="play_arrow" label={t.dub.savedTake} iconOnly onClick={() => void new Audio(savedUrl).play()} />
            </li>
          ) : null}
          {takes.map((take, i) => (
            <li key={take.url} className="bg-surface flex items-center justify-between gap-2 rounded-lg px-3 py-2" data-take={i + 1}>
              <span className="font-caption text-caption text-text-ivory">
                {fill(t.dub.take, { n: i + 1 })} · {(take.ms / 1000).toFixed(1)} s
              </span>
              <span className="flex items-center gap-1">
                <SmallButton
                  icon="play_arrow"
                  label={fill(t.dub.listen, { n: i + 1 })}
                  iconOnly
                  onClick={() => void new Audio(take.url).play()}
                />
                <SmallButton
                  icon="delete"
                  label={fill(t.dub.delete, { n: i + 1 })}
                  iconOnly
                  onClick={() => {
                    URL.revokeObjectURL(take.url);
                    setTakes((all) => all.filter((x) => x !== take));
                  }}
                />
                {editable ? (
                  <button
                    type="button"
                    data-action="keep-take"
                    disabled={keeping !== null}
                    onClick={() => keep(i)}
                    className="bg-primary text-on-primary font-label-sm text-label-sm rounded-full px-3 py-1 disabled:opacity-50"
                  >
                    {keeping === i ? t.dub.keeping : kept === i ? t.dub.kept : t.dub.keep}
                  </button>
                ) : null}
              </span>
            </li>
          ))}
          <li className="font-caption text-caption text-text-muted">{t.dub.keptNote}</li>
        </ul>
      ) : null}
      {keepError ? <p className="font-caption text-caption text-status-error">{keepError}</p> : null}
    </article>
  );
}

type ChipIcon = "play_arrow" | "stop" | "delete" | "replay" | "graphic_eq" | "mic" | "expand_more";

function SmallButton({
  icon,
  label,
  onClick,
  disabled,
  iconOnly,
  action,
}: {
  icon: ChipIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  iconOnly?: boolean;
  action?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={iconOnly ? label : undefined}
      data-action={action}
      className="bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-sm text-label-sm flex min-h-9 items-center gap-1 overflow-hidden rounded-full px-3 py-1.5 disabled:opacity-50"
    >
      <Icon name={icon} className="text-primary text-[18px]" />
      {iconOnly ? null : label}
    </button>
  );
}

function Chips({
  label,
  value,
  options,
  onChange,
  hideLabel,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; disabled?: boolean }[];
  onChange: (id: string) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {hideLabel ? null : <span className="font-label-sm text-label-sm text-text-ivory">{label}</span>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            disabled={o.disabled}
            data-chip={o.id}
            onClick={() => onChange(o.id)}
            className={
              value === o.id
                ? "px-space-md bg-primary text-on-primary font-label-sm text-label-sm rounded-full py-1.5 shadow-[0_0_12px_rgba(228,194,133,0.3)]"
                : "px-space-md bg-surface-container-high text-text-ivory font-label-sm text-label-sm rounded-full py-1.5 shadow-xs disabled:opacity-40"
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GoldButton({
  label,
  onClick,
  busy,
  disabled,
  action,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  action: string;
}) {
  return (
    <button
      type="button"
      data-action={action}
      onClick={onClick}
      disabled={busy || disabled}
      className="text-surface-container-lowest font-label-md text-label-md flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] font-semibold tracking-wide shadow-[0_0_16px_rgba(185,154,97,0.3)] active:scale-[0.98] disabled:opacity-50"
    >
      {label}
    </button>
  );
}
