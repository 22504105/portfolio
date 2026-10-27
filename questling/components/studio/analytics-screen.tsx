"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { keysOf } from "@/lib/content/campaigns/keys";
import { campaignById } from "@/lib/content/campaigns";
import { tr } from "@/lib/content/text";
import { useNow } from "@/lib/client/student";
import { useStudio } from "@/lib/client/studio";
import { dayOf } from "@/lib/game/time";
import { fill, plural } from "@/lib/i18n";
import { download, timeAgo } from "@/lib/studio/format";
import type { Member, StudioFacts } from "@/lib/studio/model";
import {
  campaignFor,
  campaignTitle,
  gradebook,
  groupGaps,
  heatmap,
  helpRequests,
  membersOf,
  skills,
  topics,
  type HelpRequest,
} from "@/lib/studio/views";
import { OBJECTIVES } from "@/lib/learning/objectives";
import { quickQuestById } from "@/lib/content/quick-quests";
import { isGraded, type CampaignKeys, type GradedScene } from "@/lib/story/graph";
import { locate, sceneProgress } from "@/lib/story/run";
import { Avatar } from "./dashboard-screen";
import { DailyEditor } from "./daily-editor";
import { StudioShell } from "./studio-shell";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/20_teacher_analytics/code.html, on what
// Questling actually records. The export reviews free-text essays checked by an AI; the app has no
// essays and no AI, so the queue is the students' help requests: the scene they are stuck at, the
// answers they gave there (from their run), the right one, and what their record shows. The mentor's
// reply goes to the student (they read it in the app). Grades, skills, the heatmap and the common
// mistakes are counted from the answers. "Слово и факт дня" is an added tab: the brief's daily
// content editor, laid out with the same parts.

type Tab = "queue" | "gradebook" | "skills" | "errors" | "daily";
type Period = "7" | "14" | "30";
type Kind = "all" | "question" | "puzzle" | "evidence";

const keyOf = (h: Pick<HelpRequest, "ref"> & { member: Pick<Member, "userId"> }) => `${h.member.userId}|${h.ref}`;

/** The scene a help request is about, in the version the student plays, and its answer key. */
function sceneOf(facts: StudioFacts, h: HelpRequest): { scene: GradedScene; chapter: string; campaign: string; keys: CampaignKeys } | null {
  const version = h.member.runs.find((r) => r.campaign === h.campaign)?.version;
  const campaign = campaignFor(facts, h.campaign, version);
  const found = campaign && locate(campaign, h.scene);
  if (!campaign || !found || !isGraded(found.scene)) return null;
  const own = facts.quests.find((q) => q.slug === h.campaign)?.versions.find((v) => v.version === campaign.version);
  const keys = campaignById.has(campaign.id) ? keysOf(campaign) : (own?.keys ?? {});
  return { scene: found.scene, chapter: found.chapter.label.ru, campaign: campaign.title.ru, keys };
}

export function AnalyticsScreen() {
  const { t, locale, facts, groupId, setGroupId } = useStudio();
  const params = useSearchParams();
  const now = useNow();
  const today = dayOf(now.toISOString());
  const [tab, setTab] = useState<Tab>(() => (params.get("student") ? "gradebook" : "queue"));
  const [period, setPeriod] = useState<Period>("14");
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<"urgent" | "recent">("urgent");
  const [showAnswered, setShowAnswered] = useState(false);
  const [selected, setSelected] = useState<string | null>(() => params.get("help"));
  const student = params.get("student");

  // A link from a group page names the group: the header switch follows it.
  const wantedGroup = params.get("group");
  useEffect(() => {
    if (wantedGroup && facts.groups.some((g) => g.id === wantedGroup)) setGroupId(wantedGroup);
  }, [wantedGroup, facts.groups, setGroupId]);

  const group = facts.groups.find((g) => g.id === groupId) ?? null;
  const all = useMemo(() => helpRequests(facts, groupId), [facts, groupId]);
  const requests = all
    .filter((h) => showAnswered || !h.answered || keyOf(h) === selected)
    .filter((h) => kind === "all" || sceneOf(facts, h)?.scene.kind === kind)
    .sort((a, b) => (sort === "urgent" ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)));
  const waiting = all.filter((h) => !h.answered).length;
  const current = requests.find((h) => keyOf(h) === selected) ?? requests[0] ?? null;
  const book = groupId ? gradebook(facts, groupId, locale) : null;
  const errorsCount = topics(facts, groupId, locale).filter((x) => x.errorRate >= 50).length;

  const tabs: { id: Tab; icon: string; badge?: number; dot?: boolean }[] = [
    { id: "queue", icon: "hourglass_top", badge: waiting },
    { id: "gradebook", icon: "table_chart" },
    { id: "skills", icon: "psychology" },
    { id: "errors", icon: "bug_report", dot: errorsCount > 0 },
    { id: "daily", icon: "wb_sunny" },
  ];
  const chip =
    "gap-space-xs px-space-md py-space-xs bg-surface-container text-text-ivory font-label-md text-label-md hover:bg-surface-container-high relative flex items-center rounded-lg shadow-sm transition-colors";

  return (
    <StudioShell section="analytics" title={t.analytics.title}>
      <div className="gap-space-lg flex w-full flex-col">
        <div className="gap-space-md flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <div className="gap-space-xs text-text-muted font-caption text-caption flex items-center tracking-wider uppercase">
                <span>{t.analytics.kicker}</span>
                <span>•</span>
                <span className="text-primary">{t.analytics.kickerAccent}</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-text-ivory font-medium">{t.analytics.heading}</h2>
            </div>
            <div className="gap-space-sm flex items-center">
              <button
                type="button"
                onClick={() => setTab("errors")}
                className="gap-space-xs px-space-md py-space-sm bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-md text-label-md flex items-center rounded-lg shadow-sm transition-colors"
              >
                <Icon name="history" className="text-[18px]" />
                <span>{t.analytics.log}</span>
              </button>
              <button
                type="button"
                disabled={!book}
                onClick={() => book && download(`${group?.name ?? "group"}.csv`, book.csv)}
                className="gap-space-xs px-space-md py-space-sm bg-surface-container-high text-primary hover:bg-surface-bright font-label-md text-label-md flex items-center rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <Icon name="download" className="text-[18px]" />
                <span>{t.analytics.exportCsv}</span>
              </button>
            </div>
          </div>

          <div className="p-space-sm bg-surface-container-low flex flex-wrap items-center justify-between gap-2 rounded-xl shadow-md">
            <div className="gap-space-sm flex flex-wrap items-center">
              <label className={chip}>
                <Icon name="shield_person" className="text-primary text-[18px]" />
                <span className="text-text-muted font-caption text-caption">{t.analytics.group}</span>
                <select
                  className="cursor-pointer appearance-none bg-transparent pr-5 font-medium focus:outline-none"
                  value={groupId ?? ""}
                  onChange={(e) => setGroupId(e.target.value)}
                  aria-label={t.analytics.group}
                >
                  {facts.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <Icon name="expand_more" className="text-on-surface-variant pointer-events-none absolute right-2 text-[16px]" />
              </label>
              <label className={chip}>
                <Icon name="date_range" className="text-secondary text-[18px]" />
                <span className="text-text-muted font-caption text-caption">{t.analytics.period}</span>
                <select
                  className="cursor-pointer appearance-none bg-transparent pr-5 focus:outline-none"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                  aria-label={t.analytics.period}
                >
                  {(["7", "14", "30"] as const).map((p) => (
                    <option key={p} value={p}>
                      {t.analytics.periods[p]}
                    </option>
                  ))}
                </select>
                <Icon name="expand_more" className="text-on-surface-variant pointer-events-none absolute right-2 text-[16px]" />
              </label>
              <label className={chip}>
                <Icon name="rule_settings" className="text-tertiary text-[18px]" />
                <span className="text-text-muted font-caption text-caption">{t.analytics.kind}</span>
                <select
                  className="cursor-pointer appearance-none bg-transparent pr-5 focus:outline-none"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind)}
                  aria-label={t.analytics.kind}
                >
                  {(["all", "question", "puzzle", "evidence"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t.analytics.kinds[k]}
                    </option>
                  ))}
                </select>
                <Icon name="expand_more" className="text-on-surface-variant pointer-events-none absolute right-2 text-[16px]" />
              </label>
            </div>
            <div className="gap-space-xs pr-space-xs flex items-center">
              <span className="font-caption text-caption text-text-muted">{t.analytics.sort}</span>
              <button
                type="button"
                onClick={() => setSort(sort === "urgent" ? "recent" : "urgent")}
                className="text-text-ivory font-label-sm text-label-sm hover:text-primary flex items-center gap-0.5 transition-colors"
              >
                <span>{t.analytics.sorts[sort]}</span>
                <Icon name="arrow_drop_down" className="text-[16px]" />
              </button>
            </div>
          </div>

          <div className="gap-space-xs bg-surface-container-lowest flex items-center overflow-x-auto rounded-xl p-1" role="tablist">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={tab === x.id}
                data-tab={x.id}
                onClick={() => setTab(x.id)}
                className={`gap-space-xs px-space-md py-space-xs font-label-md text-label-md flex items-center rounded-lg whitespace-nowrap transition-colors ${
                  tab === x.id
                    ? "bg-surface-container text-text-ivory shadow-md"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                <Icon name={x.icon} className={`text-[18px] ${tab === x.id ? "text-primary" : ""}`} />
                <span>{t.analytics.tabs[x.id]}</span>
                {x.badge ? (
                  <span className="px-space-xs bg-secondary-container text-secondary font-caption text-caption rounded-full py-0.5 font-semibold">
                    {x.badge}
                  </span>
                ) : null}
                {x.dot ? <span className="bg-status-error h-1.5 w-1.5 rounded-full"></span> : null}
              </button>
            ))}
          </div>
        </div>

        {tab === "queue" ? (
          <div className="gap-space-lg grid grid-cols-12 items-start">
            <div className="gap-space-md col-span-12 flex flex-col lg:col-span-4">
              <div className="px-space-xs flex items-center justify-between">
                <div className="gap-space-xs flex items-center">
                  <span className="font-label-md text-label-md text-text-ivory">{t.analytics.waiting}</span>
                  <span className="text-text-muted font-caption text-caption whitespace-nowrap">
                    {plural(locale, waiting, t.analytics.waitingCount)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnswered(!showAnswered)}
                  className="text-primary font-caption text-caption flex items-center gap-0.5 hover:underline"
                >
                  <Icon name="done_all" className="text-[14px]" />
                  {showAnswered ? t.analytics.hideAnswered : t.analytics.showAnswered}
                </button>
              </div>
              <div className="gap-space-sm flex flex-col">
                {requests.length === 0 ? (
                  <p className="font-body-md text-body-md text-text-muted p-space-md bg-surface-container-low rounded-xl">
                    {t.analytics.emptyQueue}
                  </p>
                ) : null}
                {requests.map((h) => {
                  const on = current && keyOf(h) === keyOf(current);
                  const info = sceneOf(facts, h);
                  const used = sceneProgress(
                    h.member.runs.find((r) => r.campaign === h.campaign) ?? ({ progress: {} } as never),
                    h.scene,
                  ).used;
                  return (
                    <button
                      key={keyOf(h)}
                      type="button"
                      data-request={keyOf(h)}
                      onClick={() => setSelected(keyOf(h))}
                      className={`p-space-md group relative overflow-hidden rounded-xl text-left transition-all duration-150 ${on ? "bg-surface-container-high shadow-xl" : "bg-surface-container-low hover:bg-surface-container shadow-md"}`}
                    >
                      {on ? <div className="bg-primary absolute top-0 bottom-0 left-0 w-1.5"></div> : null}
                      <div className="gap-space-xs pl-space-xs flex flex-col">
                        <div className="flex items-center justify-between gap-2">
                          <div className="gap-space-xs flex min-w-0 items-center">
                            <Avatar characterId={h.member.characterId} size="h-8 w-8" />
                            <div className="flex min-w-0 flex-col">
                              <span className="font-label-md text-label-md text-text-ivory group-hover:text-primary truncate font-semibold transition-colors">
                                {h.member.heroName ?? "—"}
                              </span>
                              <span className="font-caption text-caption text-text-muted truncate">
                                {h.member.username ? `@${h.member.username}` : ""} {group ? `• ${group.name}` : ""}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-space-xs font-caption text-caption shrink-0 rounded py-0.5 font-medium ${info?.scene.kind === "puzzle" ? "bg-secondary-container text-secondary" : "bg-surface-container text-primary"}`}
                          >
                            {info ? t.analytics.kinds[info.scene.kind] : "—"}
                          </span>
                        </div>
                        <div
                          className={`mt-space-xs p-space-xs flex flex-col gap-0.5 rounded-lg ${on ? "bg-surface-container-low" : "bg-surface-container-lowest"}`}
                        >
                          <div className="text-text-ivory font-body-md text-body-md flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{info ? `${info.campaign} (${info.chapter})` : h.campaign}</span>
                            <span className="text-text-muted font-caption text-caption shrink-0">{timeAgo(t, locale, h.at, now)}</span>
                          </div>
                          <span className="font-caption text-caption text-text-muted truncate">
                            {info ? (info.scene.kind === "evidence" ? info.scene.question : info.scene.parchment) : h.scene}
                          </span>
                        </div>
                        <div className="mt-space-xs pt-space-xs flex items-center justify-between">
                          <div className="gap-space-xs flex items-center">
                            <span
                              className={`h-2 w-2 rounded-full ${h.answered ? "bg-status-success" : on ? "bg-primary motion-safe:animate-pulse" : "bg-outline"}`}
                            ></span>
                            <span
                              className={`font-caption text-caption ${h.answered ? "text-status-success" : on ? "text-primary" : "text-text-muted"}`}
                            >
                              {h.answered ? t.analytics.answered : t.analytics.pending}
                            </span>
                          </div>
                          <span className="font-caption text-caption text-text-muted">{plural(locale, used, t.analytics.attempts)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="gap-space-md col-span-12 flex flex-col lg:col-span-8">
              {current ? (
                <Review
                  key={keyOf(current)}
                  request={current}
                  position={requests.findIndex((h) => keyOf(h) === keyOf(current))}
                  total={requests.length}
                  onMove={(i) => setSelected(keyOf(requests[i]))}
                  onAnswer={() => setSelected(keyOf(current))}
                />
              ) : (
                <p className="font-body-md text-body-md text-text-muted p-space-xl bg-surface-container rounded-xl">
                  {t.analytics.pickRequest}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {tab === "gradebook" ? <Gradebook student={student} /> : null}
        {tab === "errors" ? <Errors /> : null}
        {tab === "daily" ? <DailyEditor /> : null}
        {tab === "queue" || tab === "skills" ? (
          <>
            <SkillsAndHeat days={Number(period)} today={today} onGradebook={() => setTab("gradebook")} />
            <GroupGaps />
          </>
        ) : null}
      </div>
    </StudioShell>
  );
}

function Review({
  request,
  position,
  total,
  onMove,
  onAnswer,
}: {
  request: HelpRequest;
  position: number;
  total: number;
  onMove: (i: number) => void;
  /** Keeps this request on screen once answered (answered ones leave the queue otherwise). */
  onAnswer: () => void;
}) {
  const { t, locale, facts, act } = useStudio();
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [pending, start] = useTransition();
  const info = sceneOf(facts, request);
  const run = request.member.runs.find((r) => r.campaign === request.campaign);
  const progress = run ? sceneProgress(run, request.scene) : { used: 0, eliminated: [] as string[] };
  const before = facts.messages
    .filter((m) => m.userId === request.member.userId && m.ref === request.ref)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const answers = request.member.answers.filter((a) => a.scope === "story");
  const skill = info
    ? info.scene.kind === "puzzle"
      ? "cipher"
      : info.scene.kind === "question" && info.scene.listen
        ? "listening"
        : "reading"
    : "reading";
  const own = answers.filter((a) => a.skill === skill);
  const groupAnswers = membersOf(facts, null)
    .flatMap((m) => m.answers)
    .filter((a) => a.ref === request.campaign && a.question === request.scene);
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

  // The student's wrong picks (from the run) and the right answer (from the key).
  const key = info?.keys[request.scene];
  const label = (id: string) =>
    info?.scene.kind === "question"
      ? (info.scene.options.find((o) => o.id === id)?.label ?? id)
      : info?.scene.kind === "evidence"
        ? ((facts && campaignFor(facts, request.campaign)?.clues.find((c) => c.id === id)?.english) ?? id)
        : id;
  const right =
    key?.kind === "question"
      ? [label(key.correct)]
      : key?.kind === "evidence"
        ? key.correct.map(label)
        : key?.kind === "puzzle"
          ? [key.order.join(" ")]
          : [];

  return (
    <div className="p-space-xl bg-surface-container gap-space-lg flex flex-col rounded-xl shadow-xl" data-review={keyOf(request)}>
      <div className="pb-space-md flex items-start justify-between">
        <div className="gap-space-md flex items-center">
          <div className="bg-primary-container/20 text-primary flex h-12 w-12 items-center justify-center rounded-xl">
            <Icon name="history_edu" className="text-[28px]" />
          </div>
          <div className="flex flex-col">
            <div className="gap-space-xs flex items-center">
              <span className="font-caption text-caption text-primary font-semibold tracking-wider uppercase">{t.analytics.review}</span>
              <span className="text-text-muted">•</span>
              <span className="font-caption text-caption text-text-muted">
                {fill(t.analytics.attemptOf, { used: progress.used, max: info?.scene.maxAttempts ?? "?" })}
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-text-ivory">{request.member.heroName ?? "—"}</h2>
            <span className="font-body-md text-body-md text-text-muted">
              {info ? fill(t.analytics.quest, { campaign: info.campaign, chapter: info.chapter }) : request.campaign}
            </span>
          </div>
        </div>
        <div className="gap-space-xs flex items-center">
          <button
            type="button"
            disabled={position <= 0}
            onClick={() => onMove(position - 1)}
            className="p-space-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-40"
            title={t.analytics.prev}
            aria-label={t.analytics.prev}
          >
            <Icon name="arrow_back" className="text-[20px]" />
          </button>
          <span className="font-label-sm text-label-sm text-text-muted">{fill(t.analytics.position, { n: position + 1, total })}</span>
          <button
            type="button"
            disabled={position >= total - 1}
            onClick={() => onMove(position + 1)}
            className="p-space-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-40"
            title={t.analytics.next}
            aria-label={t.analytics.next}
          >
            <Icon name="arrow_forward" className="text-[20px]" />
          </button>
        </div>
      </div>

      {info ? (
        <div className="p-space-md bg-surface-container-low gap-space-xs flex flex-col rounded-xl">
          <div className="flex items-center justify-between">
            <div className="gap-space-xs font-label-sm text-label-sm text-tertiary flex items-center">
              <Icon name="assignment" className="text-[16px]" />
              <span>{t.analytics.task}</span>
            </div>
            <span className="font-caption text-caption text-text-muted">
              {fill(t.analytics.taskMeta, { kind: t.analytics.kinds[info.scene.kind], skill: t.analytics.skillNames[skill] })}
            </span>
          </div>
          <p className="font-title-sm text-title-sm text-text-ivory italic">
            “{info.scene.kind === "evidence" ? info.scene.question : info.scene.parchment}”
          </p>
          <p className="font-body-md text-body-md text-text-muted">
            {info.scene.kind === "question"
              ? tr(info.scene.prompt.task, locale)
              : info.scene.kind === "puzzle"
                ? tr(info.scene.task, locale)
                : tr(info.scene.prompt, locale)}
          </p>
        </div>
      ) : null}

      <div className="gap-space-xs flex flex-col">
        <div className="px-space-xs flex items-center justify-between">
          <span className="font-label-md text-label-md text-text-ivory gap-space-xs flex items-center">
            <Icon name="draw" className="text-primary text-[18px]" />
            <span>{t.analytics.answersTitle}</span>
          </span>
          <span className="text-text-muted font-caption text-caption">{t.analytics.answersMeta}</span>
        </div>
        <div className="p-space-lg relative flex flex-col gap-2 overflow-hidden rounded-xl bg-[#231d15] shadow-[0_8px_24px_rgba(0,0,0,0.7)]">
          <div className="absolute top-2 left-3 font-serif text-[#d9c49b]/30 select-none">✦</div>
          <div className="absolute right-3 bottom-2 font-serif text-[#d9c49b]/30 select-none">✦</div>
          {progress.eliminated.length === 0 && progress.used === 0 ? (
            <p className="font-body-md text-body-md text-[#f4ebd9]/70">{t.analytics.noPicks}</p>
          ) : null}
          {progress.eliminated.map((id) => (
            <p key={id} className="font-headline-md text-[20px] leading-relaxed text-[#f4ebd9]">
              <span className="bg-error-container/40 text-error mr-2 rounded px-1.5 py-0.5 font-sans text-[11px] tracking-wider uppercase">
                {t.analytics.wrongPicked}
              </span>
              “{label(id)}”
            </p>
          ))}
          {progress.used > progress.eliminated.length ? (
            <p className="font-body-md text-body-md text-[#f4ebd9]/70">
              {plural(locale, progress.used - progress.eliminated.length, t.analytics.attempts)} • {t.analytics.wrongPicked}
            </p>
          ) : null}
          {right.length ? (
            <p className="font-headline-md mt-1 text-[20px] leading-relaxed text-[#f4ebd9]/80">
              <span className="bg-status-success/20 text-status-success mr-2 rounded px-1.5 py-0.5 font-sans text-[11px] tracking-wider uppercase">
                {t.analytics.rightAnswer}
              </span>
              {right.map((r) => `“${r}”`).join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="p-space-md bg-surface-container-lowest gap-space-sm flex flex-col rounded-xl">
        <div className="flex items-center justify-between">
          <div className="gap-space-xs text-secondary font-label-md text-label-md flex items-center">
            <Icon name="query_stats" className="text-[18px]" />
            <span>{t.analytics.diagnostics}</span>
          </div>
          <span className="font-caption text-caption text-text-muted">{t.analytics.diagnosticsNote}</span>
        </div>
        <div className="gap-space-sm pt-space-xs grid grid-cols-1 md:grid-cols-3">
          <div className="p-space-sm bg-surface-container-low flex flex-col gap-1 rounded-lg">
            <span className="font-caption text-caption text-text-muted">
              {fill(t.analytics.diagSkill, { skill: t.analytics.skillNames[skill] })}
            </span>
            <span className="font-label-sm text-label-sm text-text-ivory">
              {fill(t.analytics.diagSkillValue, { p: pct(own.filter((a) => a.correct).length, own.length) })}
            </span>
            <span className="font-caption text-caption text-text-muted">{plural(locale, own.length, t.analytics.skillAnswers)}</span>
          </div>
          <div className="p-space-sm bg-surface-container-low flex flex-col gap-1 rounded-lg">
            <span className="font-caption text-caption text-text-muted">{t.analytics.diagClass}</span>
            <span className="font-label-sm text-label-sm text-text-ivory">
              {fill(t.analytics.diagClassValue, {
                p: pct(groupAnswers.filter((a) => !a.correct).length, groupAnswers.length),
                n: groupAnswers.length,
              })}
            </span>
          </div>
          <div className="p-space-sm bg-surface-container-low flex flex-col gap-1 rounded-lg">
            <span className="font-caption text-caption text-text-muted">{t.analytics.diagGrimoire}</span>
            <span className="font-label-sm text-label-sm text-text-ivory truncate">
              {info ? tr(info.scene.grimoire.title, locale) : "—"}
            </span>
            <span className="font-caption text-caption text-text-muted truncate">{info?.scene.grimoire.rule.formula}</span>
          </div>
        </div>
      </div>

      <form
        className="gap-space-md pt-space-xs flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          onAnswer();
          start(async () => {
            const result = await act({ type: "replyHelp", userId: request.member.userId, ref: request.ref, body: body.trim() });
            setState(result.ok ? "sent" : "error");
            if (result.ok) setBody("");
          });
        }}
      >
        {before.length ? (
          <div className="flex flex-col gap-1">
            <span className="font-caption text-caption text-text-muted">{t.analytics.sentBefore}</span>
            {before.map((m) => (
              <p key={m.id} className="font-body-md text-body-md text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2">
                {m.body}
              </p>
            ))}
          </div>
        ) : null}
        <div className="gap-space-xs flex flex-col">
          <span className="font-caption text-caption text-text-muted">{t.analytics.stamps}</span>
          <div className="gap-space-xs flex flex-wrap">
            {t.analytics.stampList.map((stamp) => (
              <button
                key={stamp}
                type="button"
                onClick={() => setBody((b) => (b ? `${b} ${stamp.replace(/^✦\s*/, "")}` : stamp.replace(/^✦\s*/, "")))}
                className="px-space-md bg-surface-container-high hover:bg-surface-bright text-text-ivory font-caption text-caption rounded-full py-1 transition-colors"
              >
                {stamp}
              </button>
            ))}
          </div>
        </div>
        <div className="gap-space-xs flex flex-col">
          <label className="font-label-sm text-label-sm text-text-ivory" htmlFor="feedback-input">
            {t.analytics.comment}
          </label>
          <textarea
            id="feedback-input"
            rows={3}
            maxLength={1000}
            value={body}
            onChange={(e) => (setBody(e.target.value), setState("idle"))}
            placeholder={t.analytics.commentPlaceholder}
            className="bg-surface-container-lowest text-text-ivory p-space-md font-body-md text-body-md focus:ring-primary w-full resize-none rounded-xl shadow-inner focus:ring-1 focus:outline-none"
          />
        </div>
        <div className="pt-space-xs flex items-center justify-between gap-2">
          <span role="status" className={`font-caption text-caption ${state === "error" ? "text-status-error" : "text-status-success"}`}>
            {state === "sent" ? t.analytics.sent : state === "error" ? t.common.failed : ""}
          </span>
          <button
            type="submit"
            disabled={pending || !body.trim()}
            data-action="send-reply"
            className="gap-space-sm px-space-xl py-space-md font-label-md text-label-md flex items-center rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] font-semibold tracking-wider text-[#101016] uppercase shadow-[0_0_16px_rgba(185,154,97,0.25)] transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
          >
            <Icon name="send" className="text-[20px]" />
            <span>{t.analytics.send}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function SkillsAndHeat({ days, today, onGradebook }: { days: number; today: string; onGradebook: () => void }) {
  const { t, locale, facts, groupId } = useStudio();
  const group = facts.groups.find((g) => g.id === groupId);
  const list = skills(facts, groupId).filter((s) => s.skill !== "cipher" || s.answers > 0);
  const known = list.filter((s) => s.answers > 0);
  const weakest = known.length ? known.reduce((a, b) => (b.percent < a.percent ? b : a)) : null;
  const heat = heatmap(facts, groupId, today, days);
  const max = Math.max(1, ...heat.rows.flatMap((r) => r.counts));
  const totalActions = heat.rows.reduce((n, r) => n + r.counts.reduce((a, b) => a + b, 0), 0);
  const pace = heat.rows.length ? (totalActions / heat.rows.length / days).toFixed(1) : "0";
  const SKILL_ICONS: Record<string, [string, string, string]> = {
    vocabulary: ["menu_book", "text-status-success", "bg-status-success"],
    grammar: ["spellcheck", "text-primary", "bg-primary"],
    reading: ["auto_stories", "text-status-success", "bg-status-success"],
    listening: ["headphones", "text-secondary", "bg-secondary"],
    cipher: ["swap_horiz", "text-tertiary", "bg-tertiary"],
  };
  const cell = (n: number) =>
    n === 0
      ? "bg-surface-container-lowest"
      : n / max > 0.75
        ? "bg-primary"
        : n / max > 0.5
          ? "bg-primary/70"
          : n / max > 0.25
            ? "bg-primary/50"
            : "bg-primary/25";
  const short = (d: string) => d.slice(8, 10);
  return (
    <div className="gap-space-lg grid grid-cols-12 items-stretch">
      <div
        className="p-space-lg bg-surface-container gap-space-md col-span-12 flex flex-col justify-between rounded-xl shadow-xl lg:col-span-5"
        data-skills
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption text-primary font-semibold tracking-wider uppercase">
              {t.analytics.skillsKicker}
            </span>
            <h3 className="font-title-sm text-title-sm text-text-ivory">
              {fill(t.analytics.skillsTitle, { group: group?.name ?? t.analytics.allGroups })}
            </h3>
          </div>
          {group ? (
            <span className="px-space-xs bg-surface-container-high text-text-ivory font-caption text-caption rounded py-0.5">
              {fill(t.analytics.skillTarget, { cefr: group.cefr })}
            </span>
          ) : null}
        </div>
        <div className="gap-space-md flex flex-col">
          {list.map((s) => {
            const [icon, text, bar] = SKILL_ICONS[s.skill];
            return (
              <div key={s.skill} className="flex flex-col gap-1">
                <div className="font-label-sm text-label-sm flex items-center justify-between">
                  <span className="text-text-ivory gap-space-xs flex items-center">
                    <Icon name={icon} className={`text-[16px] ${text}`} />
                    {t.analytics.skillNames[s.skill]}
                  </span>
                  <span
                    className={`font-semibold ${s.answers ? text : "text-text-muted"}`}
                    title={plural(locale, s.answers, t.analytics.skillAnswers)}
                  >
                    {s.answers ? `${s.percent}%` : "—"}
                  </span>
                </div>
                <div className="bg-surface-container-lowest h-2 w-full overflow-hidden rounded-full">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${s.percent}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-space-sm bg-surface-container-lowest flex items-center justify-between gap-2 rounded-lg">
          <span className="font-caption text-caption text-text-muted shrink-0">{t.analytics.weakest}</span>
          <span className="font-caption text-caption text-text-ivory text-right">
            {weakest
              ? fill(t.analytics.weakestValue, { skill: t.analytics.skillNames[weakest.skill], p: weakest.percent })
              : t.analytics.noAnswers}
          </span>
        </div>
      </div>
      <div
        className="p-space-lg bg-surface-container gap-space-md col-span-12 flex flex-col justify-between rounded-xl shadow-xl lg:col-span-7"
        data-heatmap
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption text-primary font-semibold tracking-wider uppercase">{t.analytics.heatKicker}</span>
            <h3 className="font-title-sm text-title-sm text-text-ivory">{fill(t.analytics.heatTitle, { n: days })}</h3>
          </div>
          <div className="gap-space-xs text-text-muted font-caption text-caption flex items-center">
            <span>{t.analytics.less}</span>
            <span className="bg-surface-container-lowest h-2.5 w-2.5 rounded"></span>
            <span className="bg-primary/25 h-2.5 w-2.5 rounded"></span>
            <span className="bg-primary/50 h-2.5 w-2.5 rounded"></span>
            <span className="bg-primary h-2.5 w-2.5 rounded"></span>
            <span>{t.analytics.more}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="font-body-md text-body-md w-full min-w-[560px] text-left">
            <thead>
              <tr className="text-text-muted font-caption text-caption">
                <th className="px-2 py-1 font-normal">{t.analytics.student}</th>
                {heat.dates.map((d) => (
                  <th key={d} className={`py-1 text-center font-normal ${d === today ? "text-primary font-semibold" : ""}`}>
                    {d === today ? `${short(d)} (${t.analytics.today})` : short(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.rows.map((r) => (
                <tr key={r.member.userId}>
                  <td className="font-label-sm text-label-sm text-text-ivory max-w-[140px] truncate px-2 py-1.5">
                    {r.member.heroName ?? "—"}
                  </td>
                  {r.counts.map((n, i) => (
                    <td key={i} className="p-1">
                      <div
                        className={`mx-auto rounded ${days > 14 ? "h-4 w-4" : "h-6 w-6"} ${cell(n)} ${heat.dates[i] === today && n ? "ring-primary-container ring-1" : ""}`}
                        title={fill(t.analytics.cellTitle, { name: r.member.heroName ?? "—", date: heat.dates[i], n })}
                      ></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-text-muted font-caption text-caption pt-space-xs flex items-center justify-between">
          <span>{fill(t.analytics.pace, { n: pace })}</span>
          <button type="button" onClick={onGradebook} className="text-primary cursor-pointer hover:underline">
            {t.analytics.openGradebook}
          </button>
        </div>
      </div>
    </div>
  );
}

function Gradebook({ student }: { student: string | null }) {
  const { t, locale, facts, groupId } = useStudio();
  if (!groupId) return <p className="font-body-md text-body-md text-text-muted">{t.analytics.selectGroup}</p>;
  const book = gradebook(facts, groupId, locale);
  return (
    <div className="bg-surface-container p-space-lg gap-space-md flex flex-col rounded-xl shadow-xl" data-gradebook>
      <div className="flex flex-col">
        <h3 className="font-title-sm text-title-sm text-text-ivory">{t.analytics.gradebookTitle}</h3>
        <p className="font-caption text-caption text-text-muted">
          {book.campaigns.length ? t.analytics.gradebookNote : t.analytics.noAssigned}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="font-body-md text-body-md w-full min-w-[560px] text-left">
          <thead>
            <tr className="bg-surface-container-lowest text-text-muted font-caption text-caption tracking-wider uppercase">
              <th className="py-space-sm px-space-md">{t.analytics.student}</th>
              {book.campaigns.map((c) => (
                <th key={`${c.id}@${c.version}`} className="py-space-sm px-space-md">
                  {tr(c.title, locale)}
                </th>
              ))}
              <th className="py-space-sm px-space-md text-right">{t.analytics.colAnswers}</th>
              <th className="py-space-sm px-space-md text-right">{t.analytics.colRight}</th>
            </tr>
          </thead>
          <tbody className="divide-surface-container-high/40 divide-y">
            {book.rows.map((r) => (
              <tr key={r.member.userId} className={r.member.userId === student ? "bg-primary-container/10" : ""}>
                <td className="py-space-sm px-space-md">
                  <span className="gap-space-sm flex items-center">
                    <Avatar characterId={r.member.characterId} size="h-8 w-8" />
                    <span className="flex flex-col">
                      <span className="text-text-ivory font-label-md text-label-md">{r.member.heroName ?? "—"}</span>
                      <span className="text-text-muted font-caption text-caption">{r.member.username ? `@${r.member.username}` : ""}</span>
                    </span>
                  </span>
                </td>
                {r.progress.map((p, i) => (
                  <td key={i} className="py-space-sm px-space-md">
                    <div className="flex items-center gap-2">
                      <div className="bg-surface-container-lowest h-1.5 w-24 overflow-hidden rounded-full">
                        <div
                          className={`h-full rounded-full ${p === 100 ? "bg-status-success" : "bg-primary"}`}
                          style={{ width: `${p}%` }}
                        ></div>
                      </div>
                      <span className="font-caption text-caption text-text-ivory">{p}%</span>
                    </div>
                  </td>
                ))}
                <td className="py-space-sm px-space-md text-text-muted text-right">{r.answers}</td>
                <td className="py-space-sm px-space-md text-text-ivory text-right">
                  {r.answers ? `${Math.round((r.correct / r.answers) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Errors() {
  const { t, locale, facts, groupId } = useStudio();
  const list = topics(facts, groupId, locale);
  return (
    <div className="bg-surface-container p-space-lg gap-space-md flex flex-col rounded-xl shadow-xl" data-errors>
      <div className="flex flex-col">
        <h3 className="font-title-sm text-title-sm text-text-ivory">{t.analytics.errorsTitle}</h3>
        <p className="font-caption text-caption text-text-muted">{t.analytics.errorsNote}</p>
      </div>
      {list.length === 0 ? <p className="font-body-md text-body-md text-text-muted">{t.analytics.noErrors}</p> : null}
      <div className="gap-space-sm flex flex-col">
        {list.map((x) => (
          <div key={x.id} className="p-space-md bg-surface-container-low gap-space-md flex items-center justify-between rounded-lg">
            <div className="flex min-w-0 flex-col">
              <span className="font-label-md text-label-md text-text-ivory">{x.title}</span>
              <span className="font-caption text-caption text-text-muted truncate italic">“{x.sample}”</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-caption text-caption text-text-muted">{plural(locale, x.answers, t.analytics.answersCount)}</span>
              <div className="bg-surface-container-lowest h-2 w-32 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${x.errorRate >= 50 ? "bg-status-error" : "bg-primary"}`}
                  style={{ width: `${x.errorRate}%` }}
                ></div>
              </div>
              <span
                className={`font-label-sm text-label-sm w-20 text-right ${x.errorRate >= 50 ? "text-status-error" : "text-text-ivory"}`}
              >
                {fill(t.analytics.errorRate, { p: x.errorRate })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Where the group's mistakes repeat, by objective (lib/studio/views.ts groupGaps): counts only, and what trains it. */
function GroupGaps() {
  const { t, locale, facts, groupId } = useStudio();
  const list = groupGaps(facts, groupId).slice(0, 6);
  const questTitle = (id: string) => {
    const quest = quickQuestById.get(id);
    return quest ? tr(quest.title, locale) : id;
  };
  return (
    <section className="p-space-lg bg-surface-container gap-space-md flex flex-col rounded-xl shadow-xl" data-gaps>
      <div className="flex flex-col">
        <span className="font-caption text-caption text-primary font-semibold tracking-wider uppercase">{t.analytics.gapsKicker}</span>
        <h3 className="font-title-sm text-title-sm text-text-ivory">{t.analytics.gapsTitle}</h3>
        <p className="font-caption text-caption text-text-muted mt-1">{t.analytics.gapsNote}</p>
      </div>
      {list.length ? (
        <ul className="gap-space-sm grid grid-cols-1 md:grid-cols-2">
          {list.map((gap) => (
            <li
              key={gap.objective}
              data-gap={gap.objective}
              className="p-space-md bg-surface-container-lowest flex flex-col gap-1 rounded-lg"
            >
              <span className="font-label-md text-label-md text-text-ivory">{tr(OBJECTIVES[gap.objective], locale)}</span>
              <span className="font-caption text-caption text-on-surface-variant">
                {fill(t.analytics.gapRow, { students: gap.students, p: gap.percent, n: gap.exercises })}
              </span>
              {gap.quests.length || gap.campaigns.length ? (
                <span className="font-caption text-caption text-text-muted">
                  {fill(t.analytics.gapPractice, {
                    list: [
                      ...gap.campaigns.map((c) => `«${campaignTitle(facts, c, locale)}»`),
                      ...gap.quests.map((q) => `«${questTitle(q)}»`),
                    ].join(", "),
                  })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body-md text-body-md text-text-muted">{t.analytics.gapsNone}</p>
      )}
    </section>
  );
}
