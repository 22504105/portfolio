"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { keysOf } from "@/lib/content/campaigns/keys";
import { campaignById } from "@/lib/content/campaigns";
import { tr } from "@/lib/content/text";
import { useStudio } from "@/lib/client/studio";
import { fill, plural } from "@/lib/i18n";
import { download } from "@/lib/studio/format";
import { CEFR_LEVELS, type Cefr } from "@/lib/studio/model";
import { activeGroups, library, runsOnVersion, sceneKinds, type LibraryEntry } from "@/lib/studio/views";
import { isGraded } from "@/lib/story/graph";
import { validateCampaign } from "@/lib/story/validate";
import { Modal } from "./groups-screen";
import { StudioShell } from "./studio-shell";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/19_story_library/code.html.
// The library holds the two built-in campaigns (assign them, or copy one to edit) and the teacher's
// own, with their real versions: a published version never changes, an edit is the next draft,
// "Сделать черновик из vN" starts a draft from an older version. The release log counts the runs
// bound to each version instead of the export's made-up "16 сессий стабильно"; "Diff изменений" and
// the "Telegram CDN ping" are left out. The summary counts tasks by kind across the library.

type Tab = "all" | "published" | "drafts" | "archive";

export function LibraryScreen() {
  const { t, locale, base, facts, act } = useStudio();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [level, setLevel] = useState<Cefr | "all">("all");
  const [view, setView] = useState<"catalog" | "table">("catalog");
  const [selected, setSelected] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<LibraryEntry | null>(null);
  const [rules, setRules] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const entries = useMemo(() => library(facts, locale), [facts, locale]);

  const inTab = (e: LibraryEntry, which: Tab) =>
    which === "all"
      ? e.status !== "archived"
      : which === "published"
        ? e.status === "published"
        : which === "drafts"
          ? e.draft !== null && e.status !== "archived"
          : e.status === "archived";
  const matches = (e: LibraryEntry) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const text = [e.title, e.subtitle, ...e.campaign.chapters.flatMap((c) => [tr(c.skills, locale), ...c.words])].join(" ").toLowerCase();
    return text.includes(q);
  };
  const byLevel = (e: LibraryEntry, l: Cefr | "all") => l === "all" || e.cefr.includes(l);
  const shown = entries.filter((e) => inTab(e, tab) && byLevel(e, level) && matches(e));
  const current = entries.find((e) => e.key === selected) ?? shown[0] ?? null;
  const kinds = sceneKinds(entries.filter((e) => e.status !== "archived"));
  const kindTotal = Math.max(1, kinds.question + kinds.puzzle + kinds.evidence);

  const run = (task: () => Promise<boolean>) =>
    start(async () => {
      setError(false);
      if (!(await task())) setError(true);
    });

  const fork = (entry: LibraryEntry, cefr?: Cefr) =>
    run(async () => {
      const result = await act({ type: "duplicateQuest", from: entry.id, title: fill(t.library.copyTitle, { title: entry.title }) });
      if (!result.ok || result.outcome.kind !== "ok") return false;
      if (cefr) await act({ type: "updateQuest", questId: result.outcome.id!, cefr });
      router.push(`${base}/builder?quest=${result.outcome.id}`);
      return true;
    });

  const create = () =>
    run(async () => {
      const result = await act({
        type: "createQuest",
        title: locale === "ru" ? "Новая кампания" : "A new campaign",
        cefr: level === "all" ? "A2" : level,
      });
      if (!result.ok || result.outcome.kind !== "ok") return false;
      router.push(`${base}/builder?quest=${result.outcome.id}`);
      return true;
    });

  const restoreFrom = (entry: LibraryEntry, version: number) =>
    run(async () => {
      const quest = facts.quests.find((q) => q.id === entry.id);
      const from = quest?.versions.find((v) => v.version === version);
      if (!quest || !from) return false;
      const result = await act({
        type: "saveDraft",
        questId: quest.id,
        graph: from.graph,
        keys: from.keys,
        note: fill(t.library.restoreFrom, { v: version }),
      });
      if (result.ok) router.push(`${base}/builder?quest=${quest.id}`);
      return result.ok;
    });

  const exportList = () => {
    const header = ["Title", "Kind", "CEFR", "Status", "Published", "Draft", "Groups", "Playing"];
    const rows = entries.map((e) => [
      e.title,
      e.kind,
      e.cefr,
      e.status,
      e.published ?? "",
      e.draft ?? "",
      e.assignedTo.map((g) => g.name).join("; "),
      e.playing,
    ]);
    download("library.csv", [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"));
  };

  const scriptOf = (entry: LibraryEntry) => {
    const quest = facts.quests.find((q) => q.id === entry.id);
    const version = quest?.versions.find((v) => v.version === (entry.draft ?? entry.published));
    const keys = entry.kind === "builtin" ? keysOf(campaignById.get(entry.id)!) : (version?.keys ?? {});
    download(`${entry.slug}.json`, JSON.stringify({ graph: entry.campaign, keys }, null, 2), "application/json");
  };

  return (
    <StudioShell section="library" title={t.library.title}>
      <div className="gap-space-xl flex w-full flex-col">
        <div className="gap-space-lg flex flex-col justify-between xl:flex-row xl:items-end">
          <div className="gap-space-xs flex flex-col">
            <div className="gap-space-sm flex items-center">
              <span className="px-space-xs bg-secondary-container/60 text-secondary-fixed font-caption text-caption rounded py-0.5 tracking-widest uppercase">
                {t.library.badge}
              </span>
              <span className="bg-primary-container h-1.5 w-1.5 rounded-full"></span>
              <span className="font-caption text-caption text-text-muted tracking-wider uppercase">{t.library.kicker}</span>
            </div>
            <h2 className="font-headline-xl text-headline-xl text-text-ivory tracking-tight">{t.library.heading}</h2>
            <p className="font-body-md text-body-md text-text-muted max-w-2xl">{t.library.lead}</p>
          </div>
          <div className="gap-space-md flex items-center">
            <button
              type="button"
              onClick={exportList}
              className="gap-space-xs px-space-md py-space-sm bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md flex items-center rounded-lg transition-all"
            >
              <Icon name="download" className="text-[18px]" />
              <span>{t.library.exportList}</span>
            </button>
            <button
              type="button"
              onClick={create}
              disabled={pending}
              data-action="create-campaign"
              className="gap-space-sm px-space-xl py-space-md from-primary to-primary-container text-on-primary font-label-md text-label-md flex items-center rounded-lg bg-gradient-to-b shadow-[0_0_20px_rgba(185,154,97,0.3)] transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              <Icon name="add_circle" className="text-[20px]" />
              <span>{t.library.create}</span>
            </button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="font-caption text-caption text-status-error">
            {t.common.failed}
          </p>
        ) : null}

        <div className="bg-surface-container-low p-space-lg relative overflow-hidden rounded-xl shadow-sm">
          <div className="bg-primary-container/10 pointer-events-none absolute -top-12 -right-8 h-48 w-48 rounded-full blur-3xl"></div>
          <div className="gap-space-md relative z-10 flex flex-col items-start justify-between md:flex-row md:items-center">
            <div className="gap-space-md flex items-start md:items-center">
              <div className="bg-secondary-container/50 text-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Icon name="verified_user" className="text-[22px]" />
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-text-ivory gap-space-xs flex items-center">
                  <span>{t.library.safety}</span>
                  <span className="bg-status-success h-1.5 w-1.5 rounded-full"></span>
                  <span className="font-caption text-caption text-status-success font-medium">{t.library.safetyOn}</span>
                </span>
                <p className="font-body-md text-body-md text-text-muted mt-0.5">{t.library.safetyText}</p>
                {rules ? <p className="font-body-md text-body-md text-on-surface-variant mt-2">{t.library.rulesText}</p> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRules(!rules)}
              aria-expanded={rules}
              className="font-label-sm text-label-sm text-primary hover:text-text-ivory inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <span>{t.library.rules}</span>
              <Icon name={rules ? "expand_less" : "arrow_forward"} className="text-[16px]" />
            </button>
          </div>
        </div>

        <div className="gap-space-md bg-surface-container p-space-md flex flex-col rounded-xl shadow-md">
          <div className="gap-space-md flex flex-col items-center justify-between md:flex-row">
            <div className="relative w-full flex-1">
              <Icon name="search" className="text-text-muted absolute top-1/2 left-3.5 -translate-y-1/2 text-[20px]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t.library.search}
                className="bg-surface-container-lowest text-text-ivory placeholder-text-muted font-body-md text-body-md pr-space-md py-space-sm focus:ring-primary-container w-full rounded-lg pl-11 focus:ring-1 focus:outline-none"
                placeholder={t.library.search}
              />
            </div>
            <div className="gap-space-xs bg-surface-container-lowest flex shrink-0 items-center rounded-lg p-1" role="tablist">
              {(["catalog", "table"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={
                    view === v
                      ? "px-space-md bg-primary-container text-on-primary-container font-label-sm text-label-sm flex items-center gap-1 rounded-md py-1.5 shadow-sm"
                      : "px-space-md text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm flex items-center gap-1 rounded-md py-1.5 transition-colors"
                  }
                >
                  <Icon name={v === "catalog" ? "view_agenda" : "table_rows"} className="text-[16px]" />
                  <span>{v === "catalog" ? t.library.catalog : t.library.table}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="gap-space-md pt-space-xs flex flex-col justify-between lg:flex-row lg:items-center">
            <div className="gap-space-xs flex items-center overflow-x-auto" role="tablist">
              {(["all", "published", "drafts", "archive"] as const).map((x) => (
                <button
                  key={x}
                  type="button"
                  role="tab"
                  aria-selected={tab === x}
                  onClick={() => setTab(x)}
                  className={`px-space-md font-label-md text-label-md rounded-lg py-1.5 whitespace-nowrap transition-colors ${tab === x ? "bg-surface-container-high text-primary shadow-sm" : "text-text-muted hover:text-on-surface"}`}
                >
                  {t.library.tabs[x]}{" "}
                  <span className="font-caption text-caption ml-1 opacity-75">({entries.filter((e) => inTab(e, x)).length})</span>
                </button>
              ))}
            </div>
            <div className="gap-space-xs flex flex-wrap items-center">
              <span className="font-caption text-caption text-text-muted mr-1 tracking-wider uppercase">{t.library.level}</span>
              {(["all", ...CEFR_LEVELS] as const).map((l) => {
                const count = entries.filter((e) => inTab(e, tab) && byLevel(e, l)).length;
                if (l !== "all" && count === 0) return null;
                const on = level === l;
                return (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setLevel(l)}
                    className={`px-space-sm font-label-sm text-label-sm rounded py-1 transition-colors ${
                      on
                        ? l === "all"
                          ? "bg-secondary-container/40 text-secondary-fixed"
                          : "bg-primary-container text-on-primary-container font-semibold shadow-sm"
                        : "bg-surface-container-lowest text-text-muted hover:text-text-ivory"
                    }`}
                  >
                    {l === "all" ? t.library.allLevels : l}{" "}
                    {l !== "all" ? <span className="text-caption font-caption opacity-80">({count})</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="gap-space-xl grid grid-cols-1 items-start xl:grid-cols-12">
          <div className="gap-space-lg flex flex-col xl:col-span-8">
            {shown.length === 0 ? <p className="font-body-md text-body-md text-text-muted">{t.library.empty}</p> : null}
            {view === "table" ? (
              <LibraryTable entries={shown} onSelect={setSelected} />
            ) : (
              shown.map((entry, i) => (
                <Card
                  key={entry.key}
                  entry={entry}
                  featured={i === 0}
                  selected={current?.key === entry.key}
                  onSelect={() => setSelected(entry.key)}
                  onAssign={() => setAssigning(entry)}
                  onFork={() => fork(entry)}
                  onDownload={() => scriptOf(entry)}
                  onArchive={() =>
                    run(async () => (await act({ type: "archiveQuest", questId: entry.id, archived: entry.status !== "archived" })).ok)
                  }
                  pending={pending}
                />
              ))
            )}
          </div>

          <aside className="gap-space-lg flex flex-col xl:col-span-4">
            <div className="bg-surface-container p-space-lg relative flex flex-col overflow-hidden rounded-xl shadow-md">
              <div className="mb-space-md flex items-center justify-between">
                <div className="gap-space-sm flex items-center">
                  <div className="bg-secondary-container/60 text-secondary flex h-7 w-7 items-center justify-center rounded">
                    <Icon name="source_notes" className="text-[18px]" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-title-sm text-title-sm text-text-ivory">{t.library.history}</h3>
                    {current ? <span className="font-caption text-caption text-text-muted">«{current.title}»</span> : null}
                  </div>
                </div>
                {current ? (
                  <span className="bg-surface-container-high text-primary font-caption text-caption rounded px-2 py-0.5">
                    {current.published ? fill(t.library.current, { v: current.published }) : t.library.noVersion}
                  </span>
                ) : null}
              </div>
              {!current ? (
                <p className="font-body-md text-body-md text-text-muted">{t.library.pick}</p>
              ) : current.kind === "builtin" ? (
                <p className="font-body-md text-body-md text-text-muted">{t.library.builtInHistory}</p>
              ) : (
                <History entry={current} onRestore={(v) => restoreFrom(current, v)} pending={pending} />
              )}
              {current ? (
                <div className="mt-space-lg pt-space-md bg-surface-container-low p-space-md gap-space-sm flex flex-col rounded-lg border-t-0">
                  <div className="gap-space-xs text-primary flex items-center">
                    <Icon name="fork_right" className="text-[18px]" />
                    <span className="font-label-md text-label-md text-text-ivory">{t.library.forkTitle}</span>
                  </div>
                  <p className="font-body-md text-body-md text-text-muted">{t.library.forkText}</p>
                  {(() => {
                    const index = CEFR_LEVELS.findIndex((l) => current.cefr.startsWith(l));
                    const next = CEFR_LEVELS[Math.min(CEFR_LEVELS.length - 1, index + 1)];
                    return (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => fork(current, next)}
                        className="py-space-sm px-space-md bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-sm text-label-sm flex w-full items-center justify-center gap-1.5 rounded-lg transition-all disabled:opacity-60"
                      >
                        <Icon name="alt_route" className="text-primary text-[16px]" />
                        <span>{fill(t.library.forkTo, { cefr: next })}</span>
                      </button>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            <div className="bg-surface-container p-space-lg gap-space-md flex flex-col rounded-xl shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="font-title-sm text-title-sm text-text-ivory">{t.library.summary}</h3>
                <Icon name="insights" className="text-text-muted text-[18px]" />
              </div>
              <div className="gap-space-sm flex flex-col">
                <div className="font-caption text-caption text-text-muted flex items-center justify-between">
                  <span>{t.library.summaryLead}</span>
                  <span className="text-text-ivory">
                    {plural(locale, entries.filter((e) => e.status !== "archived").length, t.library.summaryCount)}
                  </span>
                </div>
                <div className="bg-surface-container-lowest flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
                  <div
                    className="bg-primary"
                    style={{ width: `${(kinds.question / kindTotal) * 100}%` }}
                    title={`${t.library.kinds.question}: ${kinds.question}`}
                  ></div>
                  <div
                    className="bg-secondary-container"
                    style={{ width: `${(kinds.puzzle / kindTotal) * 100}%` }}
                    title={`${t.library.kinds.puzzle}: ${kinds.puzzle}`}
                  ></div>
                  <div
                    className="bg-status-success"
                    style={{ width: `${(kinds.evidence / kindTotal) * 100}%` }}
                    title={`${t.library.kinds.evidence}: ${kinds.evidence}`}
                  ></div>
                </div>
                <div className="font-caption text-caption grid grid-cols-3 gap-1 pt-1">
                  {(
                    [
                      ["question", "bg-primary"],
                      ["puzzle", "bg-secondary-container"],
                      ["evidence", "bg-status-success"],
                    ] as const
                  ).map(([k, tone]) => (
                    <div key={k} className="text-text-muted flex items-center gap-1">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`}></span>
                      <span className="truncate">
                        {t.library.kinds[k]} {Math.round((kinds[k] / kindTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      {assigning ? <AssignToGroup entry={assigning} onClose={() => setAssigning(null)} /> : null}
    </StudioShell>
  );
}

function Card(props: {
  entry: LibraryEntry;
  featured: boolean;
  selected: boolean;
  onSelect: () => void;
  onAssign: () => void;
  onFork: () => void;
  onDownload: () => void;
  onArchive: () => void;
  pending: boolean;
}) {
  const { t, locale, base, facts } = useStudio();
  const { entry } = props;
  const c = entry.campaign;
  const graded = c.chapters.flatMap((ch) => ch.scenes).filter(isGraded).length;
  // A draft shows whether it would pass the publishing check, with the teacher's own keys.
  const draft = entry.kind === "own" ? facts.quests.find((q) => q.id === entry.id)?.versions.find((v) => v.status === "draft") : undefined;
  const problems = draft ? validateCampaign(draft.graph, draft.keys) : null;
  const status =
    entry.status === "archived"
      ? { text: t.library.archived, tone: "bg-surface-container-high text-text-muted", dot: "bg-text-muted" }
      : entry.draft !== null
        ? {
            text: fill(t.library.draft, { v: entry.draft }),
            tone: "bg-primary-container/30 text-primary-fixed-dim",
            dot: "bg-primary motion-safe:animate-ping",
          }
        : {
            text: fill(t.library.published, { v: entry.published ?? 1 }),
            tone: "bg-status-success/20 text-status-success",
            dot: "bg-status-success",
          };
  const levelTone = entry.cefr.startsWith("B")
    ? "bg-secondary-container/40 text-secondary-fixed"
    : "bg-primary-container/20 text-primary-fixed-dim";
  const editLabel =
    entry.kind === "builtin"
      ? t.library.forkBuiltIn
      : entry.draft !== null
        ? fill(t.library.editDraft, { v: entry.draft })
        : fill(t.library.editNext, { v: (entry.published ?? 0) + 1 });

  return (
    <article
      className={`bg-surface-container group hover:bg-surface-container-high/60 relative overflow-hidden rounded-xl transition-all ${props.featured ? "shadow-lg" : "shadow-sm"} ${props.selected ? "ring-primary-container/50 ring-1" : ""}`}
      data-library={entry.slug}
      onClick={props.onSelect}
    >
      {props.featured ? (
        <div className="from-primary via-primary-container to-secondary-container h-1 w-full bg-gradient-to-r"></div>
      ) : null}
      <div className="p-space-lg gap-space-lg flex flex-col md:flex-row">
        <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-lg shadow-md md:h-auto md:w-56">
          <img
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            alt=""
            src={c.chapters[0].image}
          />
          <div className="from-surface-container-lowest/90 absolute inset-0 bg-gradient-to-t via-transparent to-transparent"></div>
          <div className="bg-surface-container-lowest/80 text-primary font-label-sm text-label-sm absolute top-2 left-2 flex items-center gap-1 rounded px-2 py-0.5 backdrop-blur">
            <Icon name="auto_stories" className="text-[14px]" />
            <span>{plural(locale, c.chapters.length, t.library.chapters)}</span>
          </div>
          <div
            className={`font-caption text-caption absolute bottom-2 left-2 flex items-center gap-1.5 rounded px-2 py-0.5 backdrop-blur ${status.tone}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`}></span>
            <span>{status.text}</span>
          </div>
        </div>
        <div className="gap-space-md flex flex-1 flex-col justify-between">
          <div className="gap-space-xs flex flex-col">
            <div className="gap-space-xs flex flex-wrap items-center justify-between">
              <div className="gap-space-sm flex items-center">
                <span className={`px-space-xs font-label-sm text-label-sm rounded py-0.5 font-semibold ${levelTone}`}>
                  CEFR {entry.cefr}
                </span>
                <span className="text-text-muted font-caption text-caption">• {plural(locale, graded, t.library.scenes)}</span>
              </div>
              <div className="text-text-muted font-caption text-caption flex items-center gap-1">
                <Icon name="history_edu" className="text-[16px]" />
                <span>{fill(t.library.author, { name: entry.author ?? t.library.authorBuiltIn })}</span>
              </div>
            </div>
            <h3 className="font-headline-md text-headline-md text-text-ivory group-hover:text-primary transition-colors">
              {entry.title}{" "}
              {entry.subtitle ? <span className="font-body-md text-body-md text-text-muted italic">({entry.subtitle})</span> : null}
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">{tr(c.chapters[0].description, locale)}</p>
          </div>
          {problems ? (
            <div className="bg-surface-container-low p-space-sm flex flex-col gap-1.5 rounded-lg">
              <div className="text-caption font-caption flex items-center justify-between">
                <span className="text-text-muted">
                  {fill(t.library.readiness, {
                    state: problems.length ? plural(locale, problems.length, t.library.problems) : t.library.ready,
                  })}
                </span>
              </div>
              <div className="bg-surface-container-high h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${problems.length ? "from-primary-container to-primary bg-gradient-to-r" : "bg-status-success"}`}
                  style={{ width: problems.length ? "50%" : "100%" }}
                ></div>
              </div>
            </div>
          ) : null}
          {/* A campaign with a published version shows where it is assigned, a draft next to it or not. */}
          {entry.published !== null || !problems ? (
            <div className="gap-space-sm bg-surface-container-low p-space-sm grid grid-cols-1 rounded-lg sm:grid-cols-2">
              <div className="gap-space-sm flex items-center">
                <div className="bg-surface-container-high text-secondary flex h-8 w-8 items-center justify-center rounded">
                  <Icon name="groups" className="text-[18px]" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="font-caption text-caption text-text-muted">{t.library.assignedTo}</span>
                  <span className="font-label-sm text-label-sm text-text-ivory truncate">
                    {entry.assignedTo.length ? entry.assignedTo.map((g) => `«${g.name}»`).join(", ") : t.library.nobody}
                  </span>
                </div>
              </div>
              <div className="gap-space-sm flex items-center">
                <div className="bg-surface-container-high text-status-success flex h-8 w-8 items-center justify-center rounded">
                  <Icon name="monitoring" className="text-[18px]" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="font-caption text-caption text-text-muted">{t.library.learners}</span>
                  <span className="font-label-sm text-label-sm text-text-ivory">
                    {fill(t.library.learnersValue, { n: entry.playing, p: entry.progress })}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          <div className="gap-space-sm pt-space-xs flex flex-wrap items-center justify-between" onClick={(e) => e.stopPropagation()}>
            <div className="gap-space-xs flex items-center">
              {entry.kind === "builtin" ? (
                <button
                  type="button"
                  onClick={props.onFork}
                  disabled={props.pending}
                  className="px-space-md py-space-xs bg-primary-container text-on-primary-container font-label-sm text-label-sm flex items-center gap-1.5 rounded-lg shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
                >
                  <Icon name="content_copy" className="text-[16px]" />
                  <span>{editLabel}</span>
                </button>
              ) : (
                <a
                  href={`${base}/builder?quest=${entry.id}`}
                  className="px-space-md py-space-xs bg-primary-container text-on-primary-container font-label-sm text-label-sm flex items-center gap-1.5 rounded-lg shadow-sm transition-all hover:brightness-110"
                >
                  <Icon name="edit_note" className="text-[16px]" />
                  <span>{editLabel}</span>
                </a>
              )}
              {entry.status !== "archived" && entry.published !== null ? (
                <button
                  type="button"
                  onClick={props.onAssign}
                  data-action="assign"
                  className="px-space-sm py-space-xs bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-sm text-label-sm flex items-center gap-1 rounded-lg transition-all"
                >
                  <Icon name="group_add" className="text-[16px]" />
                  <span>{t.library.assign}</span>
                </button>
              ) : null}
            </div>
            <div className="gap-space-xs flex items-center">
              <button
                type="button"
                onClick={props.onDownload}
                className="p-space-xs text-text-muted hover:text-text-ivory hover:bg-surface-container-high rounded-lg transition-colors"
                title={t.library.download}
                aria-label={t.library.download}
              >
                <Icon name="download" className="text-[18px]" />
              </button>
              {entry.kind === "own" ? (
                <>
                  <button
                    type="button"
                    onClick={props.onSelect}
                    className="px-space-sm py-space-xs bg-secondary-container/30 text-secondary-fixed hover:bg-secondary-container/50 font-label-sm text-label-sm flex items-center gap-1 rounded-lg transition-colors"
                  >
                    <Icon name="merge_type" className="text-[16px]" />
                    <span>{fill(t.library.revisions, { n: entry.versions })}</span>
                  </button>
                  <button
                    type="button"
                    onClick={props.onArchive}
                    disabled={props.pending}
                    className="p-space-xs text-text-muted hover:text-status-error hover:bg-surface-container-high rounded-lg transition-colors"
                    title={entry.status === "archived" ? t.library.restore : t.library.archive}
                    aria-label={entry.status === "archived" ? t.library.restore : t.library.archive}
                  >
                    <Icon name={entry.status === "archived" ? "unarchive" : "archive"} className="text-[18px]" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function History({ entry, onRestore, pending }: { entry: LibraryEntry; onRestore: (version: number) => void; pending: boolean }) {
  const { t, locale, facts } = useStudio();
  const quest = facts.quests.find((q) => q.id === entry.id);
  const versions = [...(quest?.versions ?? [])].reverse();
  return (
    <div className="before:bg-surface-container-highest relative flex flex-col space-y-5 pl-6 before:absolute before:top-2 before:bottom-3 before:left-2 before:w-0.5">
      {versions.map((v, i) => {
        const current = v.status === "published" && v.version === entry.published;
        const dot =
          v.status === "draft"
            ? "bg-primary-container ring-surface-container ring-4"
            : current
              ? "bg-status-success ring-surface-container shadow-[0_0_8px_rgba(99,186,158,0.5)] ring-4"
              : "bg-surface-bright ring-surface-container ring-4";
        const runs = runsOnVersion(facts, entry.slug, v.version);
        return (
          <div key={v.version} className="relative flex flex-col gap-1" data-version={v.version}>
            <div className={`absolute top-1 -left-[27px] h-3.5 w-3.5 rounded-full ${dot}`}></div>
            <div className="flex items-center justify-between gap-2">
              <span className={`font-label-md text-label-md ${i === 0 || current ? "text-text-ivory font-semibold" : "text-text-muted"}`}>
                v{v.version} {v.status === "draft" ? t.library.draftRevision : current ? t.library.currentRevision : ""}
              </span>
              <span className="font-caption text-caption text-text-muted shrink-0">
                {new Date(v.publishedAt ?? v.updatedAt).toLocaleString(locale, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">{v.note ?? t.library.noNote}</p>
            <div className="gap-space-sm mt-1 flex items-center">
              {v.status === "published" ? (
                <span className="bg-surface-container-low font-caption text-caption text-text-muted flex items-center gap-1 rounded px-1.5 py-0.5">
                  <Icon name="check_circle" className="text-status-success text-[12px]" /> {plural(locale, runs, t.library.runs)}
                </span>
              ) : null}
              {v.status === "published" && entry.draft === null ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRestore(v.version)}
                  className="font-caption text-caption text-text-muted hover:text-text-ivory"
                >
                  {fill(t.library.restoreFrom, { v: v.version })}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LibraryTable({ entries, onSelect }: { entries: LibraryEntry[]; onSelect: (key: string) => void }) {
  const { t } = useStudio();
  return (
    <div className="bg-surface-container overflow-x-auto rounded-xl shadow-md">
      <table className="font-body-md text-body-md w-full min-w-[560px] text-left">
        <thead>
          <tr className="bg-surface-container-lowest text-text-muted font-caption text-caption tracking-wider uppercase">
            <th className="py-space-sm px-space-md">{t.library.tabs.all}</th>
            <th className="py-space-sm px-space-md">CEFR</th>
            <th className="py-space-sm px-space-md">{t.library.history}</th>
            <th className="py-space-sm px-space-md">{t.library.assignedTo}</th>
            <th className="py-space-sm px-space-md">{t.library.learners}</th>
          </tr>
        </thead>
        <tbody className="divide-surface-container-high/40 divide-y">
          {entries.map((e) => (
            <tr key={e.key} className="hover:bg-surface-container-high/60 cursor-pointer" onClick={() => onSelect(e.key)}>
              <td className="py-space-sm px-space-md text-text-ivory">{e.title}</td>
              <td className="py-space-sm px-space-md text-text-muted">{e.cefr}</td>
              <td className="py-space-sm px-space-md text-text-muted">
                {e.status === "archived"
                  ? t.library.archived
                  : [
                      e.published ? fill(t.library.published, { v: e.published }) : null,
                      e.draft ? fill(t.library.draft, { v: e.draft }) : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
              </td>
              <td className="py-space-sm px-space-md text-text-muted">{e.assignedTo.map((g) => g.name).join(", ") || t.library.nobody}</td>
              <td className="py-space-sm px-space-md text-text-muted">{fill(t.library.learnersValue, { n: e.playing, p: e.progress })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignToGroup({ entry, onClose }: { entry: LibraryEntry; onClose: () => void }) {
  const { t, facts, act } = useStudio();
  const groups = activeGroups(facts);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const field =
    "bg-surface-container-lowest text-text-ivory font-body-md text-body-md px-space-md py-space-sm focus:ring-primary-container w-full rounded-lg focus:ring-1 focus:outline-none";
  return (
    <Modal title={`${t.library.assign}: ${entry.title}`} onClose={onClose}>
      <form
        className="gap-space-md flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await act({
              type: "assign",
              groupId,
              campaign: entry.slug,
              version: entry.kind === "own" ? entry.published : null,
              dueAt: due ? new Date(due).toISOString() : null,
            });
            if (result.ok) onClose();
            else setError((t.groups.errors as Record<string, string>)[result.refusal] ?? t.common.failed);
          });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-text-muted">{t.groups.title}</span>
          <select className={field} value={groupId} onChange={(e) => setGroupId(e.target.value)} name="group">
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} • {g.cefr}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-text-muted">{t.groups.dueDate}</span>
          <input className={field} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} name="due" />
        </label>
        {error ? (
          <p role="alert" className="font-caption text-caption text-status-error">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !groupId}
          className="gap-space-xs px-space-md py-space-sm text-surface-container-lowest font-label-md text-label-md flex items-center justify-center rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] disabled:opacity-60"
        >
          <Icon name="group_add" className="text-[18px]" />
          <span>{t.groups.assignButton}</span>
        </button>
      </form>
    </Modal>
  );
}
