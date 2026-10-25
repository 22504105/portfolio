"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useStudio } from "@/lib/client/studio";
import { fill, plural } from "@/lib/i18n";
import { timeAgo } from "@/lib/studio/format";
import {
  addScene,
  edges,
  GRID,
  moveScene,
  NODE_H,
  NODE_W,
  positions,
  problemsOf,
  removeScene,
  type Draft,
  type PaletteKind,
} from "@/lib/studio/builder";
import type { Cefr, Quest } from "@/lib/studio/model";
import type { Scene } from "@/lib/story/graph";
import { parseAuthored } from "@/lib/story/schema";
import { validateCampaign } from "@/lib/story/validate";
import { CampaignInspector, SceneInspector } from "./builder-inspector";
import { StudioShell } from "./studio-shell";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/18_quest_builder/code.html: the toolbar,
// the node palette, the canvas of scenes joined by arrows, and the node inspector. It edits the
// teacher's real draft: every change is saved as the draft a moment later ("автосохранение"), the
// validator is the same one publishing runs, "Опубликовать" makes the draft the next published
// version, and the preview plays the saved draft in a sandbox. The export's "Награда" node is not a
// scene kind here: rewards belong to graded scenes, chapters and endings, and the palette says so.

const PALETTE: { section: "story" | "exercises" | "logic"; kind: PaletteKind | "reward"; icon: string; tone: string }[] = [
  { section: "story", kind: "narration", icon: "castle", tone: "text-tertiary" },
  { section: "story", kind: "dialogue", icon: "forum", tone: "text-secondary" },
  { section: "story", kind: "clue", icon: "mail", tone: "text-primary" },
  { section: "exercises", kind: "question", icon: "quiz", tone: "text-primary" },
  { section: "exercises", kind: "fill", icon: "edit_note", tone: "text-text-ivory" },
  { section: "exercises", kind: "puzzle", icon: "swap_horiz", tone: "text-text-ivory" },
  { section: "exercises", kind: "listen", icon: "hearing", tone: "text-secondary" },
  { section: "exercises", kind: "evidence", icon: "fact_check", tone: "text-status-success" },
  { section: "logic", kind: "choice", icon: "call_split", tone: "text-text-muted" },
  { section: "logic", kind: "condition", icon: "rule", tone: "text-text-muted" },
  { section: "logic", kind: "reward", icon: "military_tech", tone: "text-primary" },
  { section: "logic", kind: "ending", icon: "flag", tone: "text-status-success" },
];

const KIND_ICON: Record<Scene["kind"], string> = {
  narration: "castle",
  dialogue: "forum",
  choice: "call_split",
  question: "quiz",
  puzzle: "swap_horiz",
  evidence: "fact_check",
  ending: "flag",
};

export function BuilderScreen() {
  const { t, facts, act, base } = useStudio();
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get("quest");
  const quest = facts.quests.find((q) => q.id === wanted && !q.archivedAt) ?? null;
  const [creating, setCreating] = useState(false);

  if (!quest) {
    const own = facts.quests.filter((q) => !q.archivedAt);
    return (
      <StudioShell section="builder" title={t.builder.title}>
        <div className="gap-space-lg flex max-w-3xl flex-col">
          <h2 className="font-headline-lg text-headline-lg text-text-ivory">{t.builder.title}</h2>
          <p className="font-body-md text-body-md text-text-muted">
            {t.builder.pick} {t.builder.pickBuiltIn}
          </p>
          <div className="gap-space-sm flex flex-col">
            {own.map((q) => (
              <a
                key={q.id}
                href={`${base}/builder?quest=${q.id}`}
                className="bg-surface-container hover:bg-surface-container-high p-space-md flex items-center justify-between rounded-xl transition-colors"
              >
                <span className="gap-space-sm flex items-center">
                  <Icon name="account_tree" className="text-primary text-[20px]" />
                  <span className="font-title-sm text-title-sm text-text-ivory">{q.title}</span>
                  <span className="bg-secondary-container text-on-secondary-container font-caption text-caption rounded-full px-2 py-0.5">
                    CEFR {q.cefr}
                  </span>
                </span>
                <span className="font-label-sm text-label-sm text-primary">{t.builder.open} →</span>
              </a>
            ))}
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              const result = await act({ type: "createQuest", title: t.builder.noTitle, cefr: "A2" });
              setCreating(false);
              if (result.ok && result.outcome.kind === "ok") router.push(`${base}/builder?quest=${result.outcome.id}`);
            }}
            className="px-space-xl py-space-md from-primary to-primary-container text-on-primary font-label-md text-label-md self-start rounded-lg bg-gradient-to-b disabled:opacity-60"
          >
            {t.builder.create}
          </button>
        </div>
      </StudioShell>
    );
  }
  return (
    <StudioShell section="builder" title={t.builder.title}>
      <Builder key={quest.id} quest={quest} />
    </StudioShell>
  );
}

type SaveState = { kind: "saved"; at: string } | { kind: "dirty" } | { kind: "saving" } | { kind: "error"; problem: string };

function Builder({ quest }: { quest: Quest }) {
  const { t, locale, act, base } = useStudio();
  const router = useRouter();
  const source = quest.versions.find((v) => v.status === "draft") ?? quest.versions.at(-1)!;
  const [draft, setDraft] = useState<Draft>(() => ({ graph: structuredClone(source.graph), keys: structuredClone(source.keys) }));
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: source.updatedAt });
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(true);
  const [title, setTitle] = useState(quest.title);
  const [notice, setNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const latest = useRef(draft);
  const now = new Date();

  const hasDraft = quest.versions.some((v) => v.status === "draft");
  const published = quest.versions.filter((v) => v.status === "published").at(-1)?.version ?? null;
  const draftVersion = quest.versions.find((v) => v.status === "draft")?.version ?? (published ?? 0) + 1;

  const problems = useMemo(() => {
    const parsed = parseAuthored(draft.graph, draft.keys);
    if (!parsed.ok) return [parsed.problem];
    return validateCampaign(parsed.campaign, parsed.keys);
  }, [draft]);

  /** Applies an edit to a copy of the draft; the save follows a moment later. */
  const update = useCallback((fn: (d: Draft) => void) => {
    setDraft((current) => {
      const next = structuredClone(current);
      fn(next);
      latest.current = next;
      return next;
    });
    setSave({ kind: "dirty" });
  }, []);
  const replace = (next: Draft) => {
    latest.current = next;
    setDraft(next);
    setSave({ kind: "dirty" });
  };

  const flush = useCallback(async (): Promise<boolean> => {
    setSave({ kind: "saving" });
    const result = await act({ type: "saveDraft", questId: quest.id, graph: latest.current.graph, keys: latest.current.keys });
    if (result.ok) {
      setSave({ kind: "saved", at: new Date().toISOString() });
      return true;
    }
    setSave({ kind: "error", problem: result.problems?.[0] ?? t.common.failed });
    return false;
  }, [act, quest.id, t.common.failed]);

  // Autosave: a second and a half after the last change.
  useEffect(() => {
    if (save.kind !== "dirty") return;
    const timer = setTimeout(() => void flush(), 1500);
    return () => clearTimeout(timer);
  }, [save, draft, flush]);

  // Leaving with changes not yet saved asks first.
  useEffect(() => {
    const unsaved = save.kind === "dirty" || save.kind === "saving" || save.kind === "error";
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t.builder.unsaved;
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save, t.builder.unsaved]);

  const scenes = draft.graph.chapters.flatMap((c) => c.scenes);
  const place = positions(draft.graph);
  const links = edges(draft.graph);
  const start = scenes[0]?.id;
  const number = (id: string) => scenes.findIndex((s) => s.id === id) + 1;
  const sceneTitle = (s: Scene) =>
    s.kind === "ending"
      ? s.title[locale]
      : s.kind === "dialogue"
        ? (s.lines[0]?.speaker[locale] ?? s.location[locale])
        : s.location[locale];
  const sceneLabel = (id: string) => {
    const s = scenes.find((x) => x.id === id);
    return s ? `#${number(id)} ${t.builder.nodeKinds[s.kind]}: ${sceneTitle(s)}` : id;
  };
  const current = scenes.find((s) => s.id === selected) ?? null;
  const width = Math.max(...Object.values(place).map((p) => p.x)) + NODE_W + 80;
  const height = Math.max(...Object.values(place).map((p) => p.y)) + NODE_H + 80;

  // Dragging a node moves it on the canvas (snapped to the grid when the grid is on); a click selects.
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [dragAt, setDragAt] = useState<{ id: string; x: number; y: number } | null>(null);
  const point = (e: React.PointerEvent) => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: (e.clientX - box.left + canvas.current!.scrollLeft) / zoom, y: (e.clientY - box.top + canvas.current!.scrollTop) / zoom };
  };
  const onDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const p = point(e);
    drag.current = { id, dx: p.x - place[id].x, dy: p.y - place[id].y, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    const x = Math.max(0, p.x - d.dx);
    const y = Math.max(0, p.y - d.dy);
    if (!d.moved && Math.hypot(x - place[d.id].x, y - place[d.id].y) < 4) return;
    d.moved = true;
    setDragAt({ id: d.id, x, y });
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved || !dragAt) {
      setSelected(d.id);
      return;
    }
    const snap = (v: number) => (grid ? Math.round(v / GRID) * GRID : Math.round(v));
    const at = { x: snap(dragAt.x), y: snap(dragAt.y) };
    setDragAt(null);
    update((draft) => {
      draft.graph.layout = { ...positions(draft.graph), ...draft.graph.layout, [d.id]: at };
    });
  };
  const at = (id: string) => (dragAt?.id === id ? dragAt : place[id]);

  const fit = () => {
    const box = canvas.current?.getBoundingClientRect();
    if (!box) return;
    setZoom(Math.max(0.4, Math.min(1.5, Math.floor(Math.min(box.width / width, box.height / height) * 20) / 20)));
  };

  // On opening, a graph wider than the canvas is fitted to it.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    const frame = requestAnimationFrame(() => {
      const box = canvas.current?.getBoundingClientRect();
      if (box && (box.width < width || box.height < height)) fit();
    });
    return () => cancelAnimationFrame(frame);
  });

  const add = (kind: PaletteKind | "reward") => {
    if (kind === "reward") {
      setNotice(t.builder.rewardNote);
      return;
    }
    const result = addScene(latest.current, kind, selected);
    replace(result.draft);
    setSelected(result.id);
    setNotice(null);
  };

  const publish = async () => {
    setPublishing(true);
    setNotice(null);
    const saved = save.kind === "saved" && hasDraft ? true : await flush();
    if (saved) {
      const result = await act({ type: "publish", questId: quest.id });
      if (result.ok) setNotice(fill(t.builder.published, { v: draftVersion }));
      else {
        setShowProblems(true);
        setNotice(result.problems?.[0] ?? t.common.failed);
      }
    }
    setPublishing(false);
  };

  const preview = async () => {
    if (save.kind !== "saved" || !hasDraft) {
      if (!(await flush())) return;
    }
    router.push(`${base}/preview/${quest.id}`);
  };

  const status =
    save.kind === "saving"
      ? fill(t.builder.draftSaving, { v: draftVersion })
      : save.kind === "dirty"
        ? fill(t.builder.draftDirty, { v: draftVersion })
        : save.kind === "error"
          ? fill(t.builder.draftError, { problem: save.problem })
          : hasDraft
            ? fill(t.builder.draftSaved, { v: draftVersion, ago: timeAgo(t, locale, save.at, now) })
            : fill(t.builder.publishedNoDraft, { v: published ?? 1, next: draftVersion });
  const firstProblem = problems[0];
  const problemScene = firstProblem ? scenes.find((s) => problemsOf([firstProblem], s.id).length) : undefined;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] w-full flex-col overflow-hidden select-none" data-builder={quest.id}>
      <header className="px-space-lg py-space-sm bg-surface-container-lowest mb-space-sm gap-space-sm flex shrink-0 items-center justify-between gap-2 rounded-xl shadow-md">
        <div className="gap-space-md flex min-w-0 flex-1 items-center">
          <div className="bg-surface-container text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
            <Icon name="account_tree" className="text-[20px]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="gap-space-xs flex items-center">
              <input
                className="text-text-ivory font-title-sm text-title-sm focus:bg-surface-container-low w-full min-w-[140px] truncate rounded bg-transparent px-1.5 py-0.5 tracking-wide transition-colors focus:outline-none"
                type="text"
                value={title}
                aria-label={t.builder.titleField}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() =>
                  title.trim() && title !== quest.title && void act({ type: "updateQuest", questId: quest.id, title: title.trim() })
                }
              />
              <span className="px-space-xs bg-secondary-container text-on-secondary-container font-caption text-caption shrink-0 rounded-full py-0.5 font-medium tracking-wider uppercase">
                CEFR {draft.graph.cefr}
              </span>
            </div>
            <div className="gap-space-xs flex items-center px-1.5" data-save={save.kind}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${save.kind === "error" ? "bg-status-error" : save.kind === "saved" ? "bg-status-success motion-safe:animate-pulse" : "bg-primary"}`}
              ></span>
              <span
                className={`font-caption text-caption max-w-[420px] truncate ${save.kind === "error" ? "text-status-error" : "text-text-muted"}`}
              >
                {status}
              </span>
            </div>
          </div>
        </div>
        <div className="gap-space-xs bg-surface-container-low px-space-xs flex items-center rounded-lg py-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
            className="text-on-surface-variant hover:text-text-ivory hover:bg-surface-container rounded p-1 transition-colors"
            title={t.builder.zoomOut}
            aria-label={t.builder.zoomOut}
          >
            <Icon name="remove" className="text-[18px]" />
          </button>
          <span className="font-label-sm text-label-sm text-text-ivory min-w-[48px] px-2 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
            className="text-on-surface-variant hover:text-text-ivory hover:bg-surface-container rounded p-1 transition-colors"
            title={t.builder.zoomIn}
            aria-label={t.builder.zoomIn}
          >
            <Icon name="add" className="text-[18px]" />
          </button>
          <div className="bg-surface-variant mx-1 h-4 w-px"></div>
          <button
            type="button"
            onClick={fit}
            className="text-on-surface-variant hover:text-text-ivory hover:bg-surface-container font-label-sm text-label-sm flex items-center gap-1 rounded px-2 py-1 transition-colors"
            title={t.builder.fitTitle}
          >
            <Icon name="fit_screen" className="text-[16px]" />
            <span>{t.builder.fit}</span>
          </button>
          <button
            type="button"
            onClick={() => setGrid(!grid)}
            aria-pressed={grid}
            className={`font-label-sm text-label-sm flex items-center gap-1 rounded px-2 py-1 transition-colors ${grid ? "bg-surface-container text-primary shadow-sm" : "text-on-surface-variant hover:text-text-ivory"}`}
            title={t.builder.gridTitle}
          >
            <Icon name="grid_4x4" className="text-[16px]" />
            <span>{t.builder.grid}</span>
          </button>
        </div>
        <div className="gap-space-sm flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => {
              setShowProblems(true);
              if (problemScene) setSelected(problemScene.id);
            }}
            data-action="check"
            title={t.builder.check}
            aria-label={t.builder.check}
            className="gap-space-xs px-space-md py-space-xs bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-text-ivory font-label-md text-label-md flex items-center rounded-lg shadow-sm transition-all"
          >
            <Icon
              name={problems.length ? "warning" : "verified"}
              className={`text-[18px] ${problems.length ? "text-status-error" : "text-status-success"}`}
            />
            <span className="hidden 2xl:inline">{t.builder.check}</span>
            {problems.length ? (
              <span className="bg-error-container text-on-error-container font-caption flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                {problems.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={preview}
            data-action="preview"
            title={t.builder.preview}
            aria-label={t.builder.preview}
            className="gap-space-xs px-space-md py-space-xs bg-surface-container hover:bg-surface-container-high text-text-ivory font-label-md text-label-md flex items-center rounded-lg shadow-sm transition-all"
          >
            <Icon name="send_to_mobile" className="text-secondary text-[18px]" />
            <span className="hidden 2xl:inline">{t.builder.preview}</span>
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={publishing || problems.length > 0}
            data-action="publish"
            className="gap-space-xs px-space-md py-space-xs text-surface-container-lowest font-label-md text-label-md flex items-center rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] font-semibold tracking-wide shadow-[0_0_16px_rgba(185,154,97,0.3)] transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
          >
            <Icon name="publish" className="text-[18px]" />
            <span>{t.builder.publish}</span>
          </button>
        </div>
      </header>

      <div className="gap-space-sm relative flex min-h-0 w-full flex-1">
        <aside className="bg-surface-container-lowest p-space-md flex w-[230px] shrink-0 flex-col overflow-y-auto rounded-xl shadow-md">
          <div className="mb-space-md pb-space-xs flex items-center justify-between">
            <span className="font-label-md text-label-md text-text-muted text-[11px] tracking-wider uppercase">{t.builder.palette}</span>
            <Icon name="touch_app" className="text-text-muted text-[16px]" />
          </div>
          {(["story", "exercises", "logic"] as const).map((section) => (
            <div key={section} className="gap-space-xs mb-space-md flex flex-col">
              <span className="font-caption text-caption text-primary flex items-center gap-1 font-medium tracking-widest uppercase">
                <span className="text-[10px]">✦</span> {t.builder.sections[section]}
              </span>
              {PALETTE.filter((p) => p.section === section).map((p) => {
                const [name, note] = t.builder.kinds[p.kind];
                return (
                  <button
                    key={p.kind}
                    type="button"
                    onClick={() => add(p.kind)}
                    data-palette={p.kind}
                    title={t.builder.paletteHint}
                    className="group gap-space-sm p-space-xs bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-text-ivory flex items-center rounded-lg px-2.5 text-left shadow-sm transition-all"
                  >
                    <Icon name={p.icon} className={`text-[18px] ${p.tone}`} />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-label-sm text-label-sm leading-tight">{name}</span>
                      {note ? <span className="font-caption text-text-muted truncate text-[10px]">{note}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {notice ? (
            <p className="font-caption text-caption text-on-surface-variant bg-surface-container rounded-lg p-2" role="status">
              {notice}
            </p>
          ) : null}
        </aside>

        <main
          ref={canvas}
          className="bg-surface-container-lowest relative flex-1 overflow-auto rounded-xl shadow-inner"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div
            className="relative origin-top-left"
            style={{ width: width * zoom, height: height * zoom, minWidth: "100%", minHeight: "100%" }}
            onClick={(e) => e.target === e.currentTarget && setSelected(null)}
          >
            <div
              className={`pointer-events-none absolute inset-0 ${grid ? "bg-[radial-gradient(#35343b_1px,transparent_1px)] opacity-40" : ""}`}
              style={{ backgroundSize: `${GRID * zoom}px ${GRID * zoom}px` }}
            ></div>
            <div className="absolute top-0 left-0" style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", width, height }}>
              <svg className="pointer-events-none absolute inset-0" width={width} height={height} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="glow-gold" gradientUnits="userSpaceOnUse" x1="0" x2={width} y1="0" y2="0">
                    <stop offset="0%" stopColor="#b99a61" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#e4c285" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="glow-purple" gradientUnits="userSpaceOnUse" x1="0" x2={width} y1="0" y2="0">
                    <stop offset="0%" stopColor="#8d75c9" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#b99a61" stopOpacity="0.8" />
                  </linearGradient>
                  <filter id="wire-aura" filterUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
                    <feGaussianBlur result="blur" stdDeviation="3" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                {links.map((e, i) => {
                  const a = at(e.from);
                  const b = at(e.to);
                  if (!a || !b) return null;
                  const y1 = a.y + NODE_H / 2 + (e.slots > 1 ? (e.slot - (e.slots - 1) / 2) * 18 : 0);
                  const x1 = a.x + NODE_W;
                  const x2 = b.x;
                  const y2 = b.y + NODE_H / 2;
                  const bend = Math.max(40, Math.abs(x2 - x1) / 2);
                  const broken = problemsOf(problems, e.from).length > 0;
                  return (
                    <path
                      key={i}
                      d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      filter="url(#wire-aura)"
                      stroke={broken ? "#E88484" : e.kind === "main" ? "url(#glow-gold)" : "url(#glow-purple)"}
                      strokeDasharray={e.kind === "condition" ? "6 4" : undefined}
                      strokeWidth={e.from === selected || e.to === selected ? 3 : 2}
                      opacity={e.kind === "choice" || e.kind === "condition" ? 0.8 : 1}
                    />
                  );
                })}
              </svg>
              {scenes.map((s) => {
                const p = at(s.id);
                const mine = problemsOf(problems, s.id);
                const active = s.id === selected;
                const preview =
                  s.kind === "question" || s.kind === "puzzle"
                    ? s.parchment
                    : s.kind === "evidence"
                      ? s.question
                      : s.kind === "dialogue"
                        ? s.lines[0]?.text
                        : s.text;
                const badge = mine.length
                  ? t.builder.problemTag
                  : s.id === start
                    ? t.builder.start
                    : "clue" in s && s.clue
                      ? fill(t.builder.clueTag, { title: draft.graph.clues.find((c) => c.id === s.clue)?.title[locale] ?? s.clue })
                      : t.builder.nodeKinds[s.kind];
                return (
                  <div
                    key={s.id}
                    data-node={s.id}
                    onPointerDown={(e) => onDown(e, s.id)}
                    className={`p-space-sm absolute flex cursor-pointer touch-none flex-col gap-1.5 rounded-xl shadow-lg transition-shadow ${
                      active
                        ? "bg-surface ring-primary z-20 shadow-[0_0_24px_rgba(185,154,97,0.35)] ring-2"
                        : "bg-surface-container hover:bg-surface-container-high"
                    } ${mine.length && !active ? "ring-status-error/60 ring-1" : ""}`}
                    style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`font-caption flex min-w-0 items-center gap-1 truncate rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                          mine.length
                            ? "bg-error-container text-on-error-container"
                            : s.id === start
                              ? "bg-surface-container-high text-primary"
                              : s.kind === "ending"
                                ? "bg-status-success/20 text-status-success"
                                : "bg-surface-container-high text-secondary"
                        }`}
                      >
                        {mine.length ? <Icon name="error" className="text-[12px]" /> : null}
                        <span className="truncate">{badge}</span>
                      </span>
                      <span className="font-caption text-text-muted flex shrink-0 items-center gap-1 text-[10px]">
                        #{number(s.id)}
                        <Icon
                          name={s.kind === "question" && s.listen ? "hearing" : KIND_ICON[s.kind]}
                          className="text-primary text-[16px]"
                        />
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm text-text-ivory truncate leading-snug font-semibold">{sceneTitle(s)}</span>
                    <span
                      className={`font-caption text-caption line-clamp-1 ${mine.length ? "text-status-error font-medium" : "text-text-muted"}`}
                    >
                      {mine.length ? mine[0].replace(/^[^:]+:\s*/, "") : preview}
                    </span>
                    {s.id !== start ? (
                      <div className="bg-surface-container-lowest absolute top-1/2 -left-2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full">
                        <div className="bg-secondary h-2 w-2 rounded-full shadow-[0_0_8px_#d0bcff]"></div>
                      </div>
                    ) : null}
                    {s.kind !== "ending" ? (
                      <div className="bg-surface-container-lowest absolute top-1/2 -right-2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full">
                        <div
                          className={`h-2 w-2 rounded-full ${mine.length ? "bg-status-error motion-safe:animate-ping" : "bg-primary shadow-[0_0_8px_#b99a61]"}`}
                        ></div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="gap-space-md px-space-md bg-surface-container-lowest/80 sticky bottom-3 left-4 ml-4 inline-flex items-center rounded-lg py-1.5 backdrop-blur-md">
            {(
              [
                ["main", "bg-status-success"],
                ["dialogue", "bg-secondary"],
                ["errors", "bg-status-error"],
              ] as const
            ).map(([k, tone]) => (
              <div key={k} className="font-caption text-text-muted flex items-center gap-1.5 text-[11px]">
                <span className={`h-2 w-2 rounded-full ${tone}`}></span>
                <span>{t.builder.legend[k]}</span>
              </div>
            ))}
          </div>
        </main>

        <aside className="bg-surface-container-lowest flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl shadow-md">
          <div className="p-space-md bg-surface-container-low flex shrink-0 items-center justify-between">
            <div className="flex min-w-0 flex-col">
              <span className="font-caption text-caption text-primary font-semibold tracking-widest uppercase">
                {current ? fill(t.builder.inspector, { n: number(current.id) }) : t.builder.campaignInspector}
              </span>
              <h2 className="font-title-sm text-title-sm text-text-ivory truncate leading-tight">
                {current ? `${t.builder.nodeKinds[current.kind]} (${sceneTitle(current)})` : draft.graph.title[locale] || t.builder.noTitle}
              </h2>
            </div>
            {current ? (
              <div className="flex shrink-0 items-center gap-0.5" aria-label={t.builder.menu}>
                <button
                  type="button"
                  onClick={() => replace(moveScene(latest.current, current.id, -1))}
                  className="text-on-surface-variant hover:text-text-ivory hover:bg-surface-container rounded p-1"
                  title={t.builder.moveUp}
                  aria-label={t.builder.moveUp}
                >
                  <Icon name="arrow_upward" className="text-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => replace(moveScene(latest.current, current.id, 1))}
                  className="text-on-surface-variant hover:text-text-ivory hover:bg-surface-container rounded p-1"
                  title={t.builder.moveDown}
                  aria-label={t.builder.moveDown}
                >
                  <Icon name="arrow_downward" className="text-[18px]" />
                </button>
                <button
                  type="button"
                  data-action="remove-node"
                  onClick={() => {
                    const next = removeScene(latest.current, current.id);
                    if (!next) return setNotice(t.builder.removeLast);
                    replace(next);
                    setSelected(null);
                  }}
                  className="text-on-surface-variant hover:text-status-error hover:bg-surface-container rounded p-1"
                  title={t.builder.remove}
                  aria-label={t.builder.remove}
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ) : null}
          </div>
          <div className="p-space-md flex flex-1 flex-col overflow-y-auto select-text">
            {current ? (
              <SceneInspector key={current.id} draft={draft} scene={current} update={update} sceneLabel={sceneLabel} />
            ) : (
              <CampaignInspector
                draft={draft}
                update={update}
                onCefr={(cefr: Cefr) => void act({ type: "updateQuest", questId: quest.id, cefr })}
              />
            )}
          </div>
          <div
            className={`p-space-sm gap-space-sm flex shrink-0 items-start ${problems.length ? "bg-error-container/20" : "bg-status-success/10"}`}
            data-validator={problems.length}
          >
            <Icon
              name={problems.length ? "error_outline" : "task_alt"}
              className={`shrink-0 text-[20px] ${problems.length ? "text-status-error" : "text-status-success"}`}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-label-sm text-label-sm text-text-ivory leading-tight font-semibold">
                {t.builder.validator}
                {problems.length ? ` • ${plural(locale, problems.length, t.builder.problems)}` : ""}
              </span>
              {problems.length ? (
                (showProblems ? problems.slice(0, 6) : problems.slice(0, 1)).map((p) => (
                  <span key={p} className="text-error font-mono text-[11px] leading-snug break-words">
                    {p.replace(/^[^:]+:\s*/, "")}
                  </span>
                ))
              ) : (
                <span className="font-caption text-status-success text-[11px]">{t.builder.valid}</span>
              )}
            </div>
            {problemScene ? (
              <button
                type="button"
                onClick={() => (setSelected(problemScene.id), setShowProblems(true))}
                className="font-caption text-primary ml-auto shrink-0 text-[11px] hover:underline"
              >
                {t.builder.go}
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
