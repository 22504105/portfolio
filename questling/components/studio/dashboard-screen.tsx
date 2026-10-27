"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { characters } from "@/lib/content/characters";
import { tr } from "@/lib/content/text";
import { useNow } from "@/lib/client/student";
import { useStudio } from "@/lib/client/studio";
import { dayOf } from "@/lib/game/time";
import { fill, plural } from "@/lib/i18n";
import { download, schoolYear, signed, timeAgo } from "@/lib/studio/format";
import { practiceCampaign } from "@/lib/studio/practice";
import { activeGroups, campaignFor, gradebook, groupCard, kpis, pendingHelp, topics, weekActivity } from "@/lib/studio/views";
import { locate } from "@/lib/story/run";
import { StudioShell } from "./studio-shell";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/16_teacher_dashboard/code.html.
// Every figure is worked out from the students' records (lib/studio/views.ts). The export's review
// queue of essays and voice answers becomes the queue of help requests (students with no attempts
// left in a story scene): Questling has no free-text answers, and grading them by AI is outside the
// brief. "Сгенерировать мини-тест" builds a draft from the class's hardest questions, no AI.
// The Telegram card states what is true (how students join) instead of the export's webhook figures.
// "Демонстрационные данные" shows in the demo studio only.

export function DashboardScreen() {
  const { t, locale, base, facts, mode, act, groupId } = useStudio();
  const router = useRouter();
  const now = useNow();
  const today = dayOf(now);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const k = kpis(facts, today);
  const groups = activeGroups(facts);
  const week = weekActivity(facts, null, today);
  const lastWeek = weekActivity(facts, null, today, 1).reduce((n, d) => n + d.count, 0);
  const weekTotal = week.reduce((n, d) => n + d.count, 0);
  const peak = week.reduce((best, d) => (d.count > best.count ? d : best), week[0]);
  const max = Math.max(1, ...week.map((d) => d.count));
  const hard = topics(facts, null, locale);
  const shownTopics = [...hard.filter((x) => x.errorRate > 0).slice(0, 2), ...hard.filter((x) => x.errorRate === 0).slice(0, 1)];
  const queue = pendingHelp(facts, null);
  const group = facts.groups.find((g) => g.id === groupId) ?? null;

  function newQuest() {
    setError(false);
    startTransition(async () => {
      const result = await act({
        type: "createQuest",
        title: locale === "ru" ? "Новая кампания" : "A new campaign",
        cefr: group?.cefr ?? "A2",
      });
      if (result.ok && result.outcome.kind === "ok") router.push(`${base}/builder?quest=${result.outcome.id}`);
      else setError(true);
    });
  }

  function practice() {
    setError(false);
    startTransition(async () => {
      const title = fill(t.dashboard.practiceTitle, { group: group?.name ?? t.shell.noGroup });
      const created = await act({ type: "createQuest", title, cefr: group?.cefr ?? "A2" });
      if (!created.ok || created.outcome.kind !== "ok") return setError(true);
      const questId = created.outcome.id!;
      const { graph, keys } = practiceCampaign(facts, groupId, `t-practice-${questId.slice(0, 8)}`, title, group?.cefr ?? "A2");
      const saved = await act({ type: "saveDraft", questId, graph, keys, note: null });
      if (saved.ok) router.push(`${base}/builder?quest=${questId}`);
      else setError(true);
    });
  }

  function exportBook() {
    if (!group) return;
    download(`${group.name}.csv`, gradebook(facts, group.id, locale).csv);
  }

  const progressTone = ["from-primary to-primary-container", "from-status-success to-tertiary", "from-secondary-container to-secondary"];
  const labelTone = ["text-primary", "text-tertiary-fixed", "text-secondary"];
  const valueTone = ["text-primary", "text-status-success", "text-secondary"];

  return (
    <StudioShell section="dashboard" title={t.dashboard.title}>
      <div className="gap-y-space-xl flex w-full flex-col">
        <div className="bg-surface p-space-xl gap-space-lg relative flex flex-col items-start justify-between overflow-hidden rounded-xl shadow-xl md:flex-row md:items-center">
          <div className="bg-secondary-container/20 pointer-events-none absolute -top-24 -right-20 h-80 w-80 rounded-full blur-3xl"></div>
          <div className="bg-primary-container/15 pointer-events-none absolute -bottom-20 left-1/3 h-64 w-64 rounded-full blur-2xl"></div>
          <div className="gap-space-xs z-10 flex max-w-2xl flex-col">
            <div className="gap-space-sm flex items-center">
              <span className="px-space-sm bg-secondary-container text-secondary font-caption text-caption inline-flex items-center gap-1.5 rounded-full py-0.5 tracking-wider uppercase">
                <Icon name="auto_awesome" className="text-[14px]" />
                {t.dashboard.badge}
              </span>
              <span className="px-space-sm bg-surface-container-high text-primary font-caption text-caption inline-flex items-center gap-1 rounded-full py-0.5">
                {fill(t.dashboard.term, { year: schoolYear(now) })}
              </span>
            </div>
            <h2 className="font-headline-xl text-headline-xl text-text-ivory mt-1 tracking-tight">
              {fill(t.dashboard.heading, { name: facts.teacher.displayName })}
            </h2>
            <p className="font-body-md text-body-md text-text-muted">{t.dashboard.lead}</p>
          </div>
          <div className="gap-space-sm z-10 flex flex-wrap items-center">
            <Link
              href={`${base}/groups`}
              className="gap-space-xs px-space-md py-space-sm bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md flex items-center rounded-lg shadow-sm transition-all"
            >
              <Icon name="person_add" className="text-primary text-[18px]" />
              <span>{t.dashboard.addStudent}</span>
            </Link>
            <button
              type="button"
              onClick={exportBook}
              disabled={!group}
              className="gap-space-xs px-space-md py-space-sm bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-label-md text-label-md flex items-center rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Icon name="download" className="text-[18px]" />
              <span>{t.dashboard.export}</span>
            </button>
            <button
              type="button"
              onClick={newQuest}
              disabled={pending}
              data-action="new-quest"
              className="gap-space-xs px-space-lg py-space-sm from-primary to-primary-container text-surface-container-lowest font-label-md text-label-md flex items-center rounded-lg bg-gradient-to-b shadow-[0_0_16px_rgba(185,154,97,0.3)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              <Icon name="magic_button" className="text-surface-container-lowest text-[18px]" />
              <span>{t.dashboard.newQuest}</span>
            </button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="font-caption text-caption text-status-error">
            {t.common.failed}
          </p>
        ) : null}

        <div className="gap-space-sm flex flex-col">
          <div className="px-space-xs flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-text-muted flex items-center gap-1.5 tracking-widest uppercase">
              <span className="bg-primary h-1.5 w-1.5 rounded-full"></span>
              {t.dashboard.kpis}
            </span>
            {mode === "demo" ? (
              <span className="px-space-sm bg-surface-container text-primary-fixed font-caption text-caption rounded-full py-0.5 tracking-wider uppercase">
                {t.common.demoData}
              </span>
            ) : null}
          </div>
          <div className="gap-space-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label={t.dashboard.groups}
              value={plural(locale, k.groups, t.dashboard.groupsValue)}
              icon="hub"
              iconTone="text-primary"
              left={k.levels.map(([cefr, n]) => `${cefr}: ${n}`).join(" • ") || "—"}
              right={fill(t.dashboard.allActive, { n: k.students })}
              rightTone="text-primary"
              footIcon="groups"
              footTone="text-primary"
              foot={plural(locale, k.students, t.common.students)}
            />
            <Kpi
              label={t.dashboard.assigned}
              value={plural(locale, k.assignments, t.dashboard.assignedValue)}
              icon="menu_book"
              iconTone="text-secondary"
              left={fill(t.dashboard.assignedSplit, { builtIn: k.builtIn, own: k.own })}
              right={fill(t.dashboard.finish, { n: k.completion })}
              rightTone="text-status-success"
              footIcon="trending_up"
              footTone="text-status-success"
              foot={fill(t.dashboard.averageFinish, { n: k.completion })}
            />
            <div className="bg-surface p-space-lg group hover:bg-surface-container relative flex flex-col justify-between overflow-hidden rounded-xl shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-caption text-caption text-text-muted tracking-wider uppercase">{t.dashboard.waiting}</span>
                    {k.pending ? (
                      <span className="bg-secondary-container text-secondary font-caption rounded px-1.5 py-0.5 text-[10px] font-bold tracking-tight uppercase">
                        {t.dashboard.attention}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-headline-lg text-headline-lg text-secondary-fixed mt-1">
                    {plural(locale, k.pending, t.dashboard.waitingValue)}
                  </span>
                </div>
                <div className="bg-secondary-container/40 text-secondary flex h-10 w-10 items-center justify-center rounded-lg shadow-[0_0_12px_rgba(141,117,201,0.25)] transition-transform group-hover:scale-110">
                  <Icon name="draw" className="text-[22px]" />
                </div>
              </div>
              <div className="mt-space-md pt-space-xs flex flex-col gap-1">
                <div className="font-caption text-caption text-on-surface-variant flex items-center justify-between gap-2">
                  <span>{t.dashboard.waitingSplit}</span>
                  <span className="text-secondary shrink-0 font-medium">{fill(t.dashboard.queue, { n: k.pending })}</span>
                </div>
                <div className="text-text-muted font-label-sm text-label-sm flex items-center gap-1">
                  <Icon name="pending_actions" className="text-secondary text-[15px]" />
                  <span>{t.dashboard.waitingNote}</span>
                </div>
              </div>
            </div>
            <Kpi
              label={t.dashboard.activity}
              value={fill(t.dashboard.activityValue, { n: k.activity.toLocaleString(locale) })}
              icon="local_fire_department"
              iconTone="text-primary-fixed"
              left={`${t.dashboard.streak}: ${plural(locale, k.bestStreak, t.dashboard.streakValue)}`}
              right={k.activityDelta === null ? "" : signed(k.activityDelta)}
              rightTone={k.activityDelta !== null && k.activityDelta < 0 ? "text-status-error" : "text-status-success"}
              footIcon={k.activityDelta !== null && k.activityDelta < 0 ? "south_east" : "north_east"}
              footTone={k.activityDelta !== null && k.activityDelta < 0 ? "text-status-error" : "text-status-success"}
              foot={k.activityDelta === null ? "" : fill(t.dashboard.activityDelta, { delta: signed(k.activityDelta) })}
            />
          </div>
        </div>

        <div className="gap-space-xl grid grid-cols-1 items-start lg:grid-cols-12">
          <div className="gap-space-xl flex flex-col lg:col-span-8">
            <div className="gap-space-md flex flex-col">
              <div className="flex items-center justify-between">
                <div className="gap-space-sm flex items-center">
                  <div className="bg-surface-container text-primary flex h-7 w-7 items-center justify-center rounded-md">
                    <Icon name="castle" className="text-[18px]" />
                  </div>
                  <h2 className="font-title-sm text-title-sm text-text-ivory">{t.dashboard.classes}</h2>
                </div>
                <Link
                  href={`${base}/groups`}
                  className="font-label-sm text-label-sm text-primary hover:text-primary-fixed flex items-center gap-1 transition-colors"
                >
                  <span>{fill(t.dashboard.allClasses, { n: groups.length })}</span>
                  <Icon name="arrow_forward" className="text-[14px]" />
                </Link>
              </div>
              {groups.length === 0 ? (
                <div className="bg-surface p-space-lg gap-space-md flex items-center justify-between rounded-xl shadow-md">
                  <p className="font-body-md text-body-md text-text-muted">{t.dashboard.noGroups}</p>
                  <Link
                    href={`${base}/groups?new=1`}
                    className="px-space-md bg-primary text-surface-container-lowest font-label-sm text-label-sm shrink-0 rounded-lg py-1.5"
                  >
                    {t.dashboard.createGroup}
                  </Link>
                </div>
              ) : (
                <div className="gap-space-md grid grid-cols-1 md:grid-cols-3">
                  {groups.slice(0, 3).map((g, i) => {
                    const card = groupCard(facts, g, locale);
                    return (
                      <div
                        key={g.id}
                        data-class-card={g.id}
                        className="bg-surface p-space-md hover:bg-surface-container flex flex-col justify-between rounded-xl shadow-md transition-all"
                      >
                        <div className="gap-space-xs flex flex-col">
                          <div className="flex items-center justify-between">
                            <span
                              className={`bg-surface-container-high font-caption text-caption rounded px-2 py-0.5 font-semibold ${labelTone[i % 3]}`}
                            >
                              {fill(t.dashboard.classLevel, { cefr: g.cefr })}
                            </span>
                            <span className="font-caption text-caption text-text-muted flex items-center gap-1">
                              <Icon name="group" className="text-[14px]" /> {fill(t.common.studentsShort, { n: card.members })}
                            </span>
                          </div>
                          <h3 className="font-headline-md text-headline-md text-text-ivory mt-1">{g.name}</h3>
                          <p className="font-caption text-caption text-text-muted flex items-center gap-1">
                            <Icon name="cloud_download" className="text-tertiary text-[14px]" />
                            <span>{card.chapter ?? t.dashboard.noAssignment}</span>
                          </p>
                        </div>
                        <div className="my-space-md flex flex-col gap-1.5">
                          <div className="font-caption text-caption flex justify-between">
                            <span className="text-text-muted">{t.dashboard.progress}</span>
                            <span className={`font-medium ${valueTone[i % 3]}`}>{card.progress}%</span>
                          </div>
                          <div className="bg-surface-container-lowest h-1.5 w-full overflow-hidden rounded-full">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${progressTone[i % 3]}`}
                              style={{ width: `${card.progress}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="pt-space-xs gap-space-sm flex flex-col">
                          <div className="text-caption font-caption text-on-surface-variant flex items-center justify-between gap-2">
                            <span className={`flex items-center gap-1 ${card.pending ? "text-secondary" : "text-text-muted"}`}>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${card.pending ? "bg-secondary motion-safe:animate-pulse" : "bg-surface-container-highest"}`}
                              ></span>
                              {card.pending ? plural(locale, card.pending, t.dashboard.pendingClass) : t.dashboard.noPending}
                            </span>
                            <span className="text-text-muted truncate">{facts.teacher.displayName}</span>
                          </div>
                          <Link
                            href={`${base}/groups?group=${g.id}`}
                            className={`px-space-sm bg-surface-container-high hover:bg-surface-bright font-label-sm text-label-sm flex w-full items-center justify-center gap-1 rounded py-1.5 text-center transition-colors ${i === 0 ? "text-primary" : "text-text-ivory"}`}
                          >
                            <span>{t.dashboard.openGroup}</span>
                            <Icon name="arrow_forward" className="text-[14px]" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-surface p-space-lg gap-space-md flex flex-col rounded-xl shadow-xl">
              <div className="flex items-center justify-between">
                <div className="gap-space-sm flex items-center">
                  <div className="bg-secondary-container text-secondary flex h-8 w-8 items-center justify-center rounded-lg">
                    <Icon name="grading" className="text-[20px]" />
                  </div>
                  <div>
                    <h2 className="font-title-sm text-title-sm text-text-ivory leading-tight">{t.dashboard.review}</h2>
                    <p className="font-caption text-caption text-text-muted">{t.dashboard.reviewLead}</p>
                  </div>
                </div>
                <span className="px-space-sm bg-secondary-container text-secondary font-label-sm text-label-sm rounded py-1 font-semibold">
                  {fill(t.dashboard.reviewCount, { n: queue.length })}
                </span>
              </div>
              <div className="w-full overflow-x-auto">
                <table className="font-body-md text-body-md w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="bg-surface-container-lowest text-text-muted font-caption text-caption tracking-wider uppercase">
                      <th className="py-space-sm px-space-md rounded-l-lg">{t.dashboard.colStudent}</th>
                      <th className="py-space-sm px-space-md">{t.dashboard.colQuest}</th>
                      <th className="py-space-sm px-space-md">{t.dashboard.colTask}</th>
                      <th className="py-space-sm px-space-md">{t.dashboard.colTime}</th>
                      <th className="py-space-sm px-space-md rounded-r-lg text-right">{t.dashboard.colAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-surface-container-high/40 divide-y">
                    {queue.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-space-md px-space-md text-text-muted font-caption text-caption">
                          {t.dashboard.reviewEmpty}
                        </td>
                      </tr>
                    ) : null}
                    {queue.slice(0, 6).map((request, i) => {
                      const campaign = campaignFor(facts, request.campaign);
                      const scene = campaign ? locate(campaign, request.scene)?.scene : undefined;
                      const groupName = facts.groups.find((g) => request.member.groups.some((x) => x.groupId === g.id))?.name ?? "";
                      const task = scene && "grimoire" in scene ? tr(scene.grimoire.title, locale) : request.scene;
                      const line = scene && "parchment" in scene ? scene.parchment : scene && "question" in scene ? scene.question : "";
                      return (
                        <tr
                          key={`${request.member.userId}-${request.ref}`}
                          className="hover:bg-surface-container/60 transition-colors"
                          data-help={request.ref}
                        >
                          <td className="py-space-md px-space-md">
                            <div className="gap-space-sm flex items-center">
                              <Avatar characterId={request.member.characterId} />
                              <div className="flex min-w-0 flex-col">
                                <span className="font-label-md text-label-md text-text-ivory truncate">
                                  {request.member.heroName ?? request.member.username}
                                </span>
                                <span className="font-caption text-caption text-primary">{groupName}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-space-md px-space-md text-on-surface-variant font-body-md text-body-md">
                            {campaign ? tr(campaign.title, locale) : request.campaign}
                          </td>
                          <td className="py-space-md px-space-md">
                            <div className="flex max-w-xs flex-col">
                              <span className="font-label-sm text-label-sm text-text-ivory truncate">{task}</span>
                              {line ? (
                                <span className="font-caption text-caption text-text-muted truncate italic">&quot;{line}&quot;</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-space-md px-space-md text-text-muted font-caption text-caption whitespace-nowrap">
                            {timeAgo(t, locale, request.at, now)}
                          </td>
                          <td className="py-space-md px-space-md text-right">
                            <Link
                              href={`${base}/analytics?help=${encodeURIComponent(`${request.member.userId}|${request.ref}`)}`}
                              className={
                                i < 2
                                  ? "px-space-md bg-primary hover:bg-primary-fixed text-surface-container-lowest font-label-sm text-label-sm rounded-lg py-1.5 shadow-sm transition-all"
                                  : "px-space-md bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-sm text-label-sm rounded-lg py-1.5 transition-all"
                              }
                            >
                              {t.dashboard.answer}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="gap-space-xl flex flex-col lg:col-span-4">
            <div className="bg-surface p-space-lg gap-space-md flex flex-col rounded-xl shadow-xl">
              <div className="flex items-center justify-between">
                <div className="gap-space-sm flex items-center">
                  <Icon name="bar_chart" className="text-primary text-[20px]" />
                  <h3 className="font-title-sm text-title-sm text-text-ivory">{t.dashboard.week}</h3>
                </div>
                <span className="font-caption text-caption text-primary font-medium">
                  {plural(locale, weekTotal, t.dashboard.weekTotal)}
                </span>
              </div>
              <p className="font-caption text-caption text-text-muted -mt-2">{t.dashboard.weekLead}</p>
              <div className="bg-surface-container-lowest p-space-md flex w-full flex-col rounded-lg">
                <svg className="h-32 w-full" preserveAspectRatio="none" viewBox="0 0 280 120" role="img" aria-label={t.dashboard.week}>
                  <line className="text-surface-bright/30" stroke="currentColor" strokeDasharray="2" x1="0" x2="280" y1="20" y2="20"></line>
                  <line className="text-surface-bright/30" stroke="currentColor" strokeDasharray="2" x1="0" x2="280" y1="60" y2="60"></line>
                  <line className="text-surface-bright/30" stroke="currentColor" x1="0" x2="280" y1="100" y2="100"></line>
                  {week.map((d, i) => {
                    const height = Math.max(2, Math.round((d.count / max) * 78));
                    const isPeak = d === peak && d.count > 0;
                    return (
                      <rect
                        key={d.day}
                        className={
                          isPeak
                            ? "fill-primary-container hover:fill-primary shadow-sm"
                            : "fill-surface-container-high hover:fill-primary transition-all"
                        }
                        height={height}
                        rx="3"
                        width="22"
                        x={12 + i * 40}
                        y={100 - height}
                      >
                        <title>{`${t.common.weekdays[d.weekday]}: ${d.count}`}</title>
                      </rect>
                    );
                  })}
                </svg>
                <div className="font-caption text-text-muted mt-2 flex justify-between px-1 text-[11px]">
                  {week.map((d) => (
                    <span key={d.day} className={d === peak && d.count > 0 ? "text-primary font-bold" : ""}>
                      {t.common.weekdays[d.weekday]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-caption font-caption text-text-muted flex items-center justify-between pt-1">
                <span className="flex items-center gap-1">
                  <span className="bg-primary-container h-2 w-2 rounded"></span>
                  {fill(t.dashboard.peak, { day: t.common.weekdaysLong[peak.weekday], n: peak.count })}
                </span>
                {lastWeek > 0 ? (
                  <span className={weekTotal >= lastWeek ? "text-status-success" : "text-status-error"}>
                    {fill(t.dashboard.weekDelta, { delta: signed(Math.round(((weekTotal - lastWeek) / lastWeek) * 100)) })}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="bg-surface p-space-lg gap-space-md flex flex-col rounded-xl shadow-xl">
              <div className="flex items-center justify-between">
                <div className="gap-space-sm flex items-center">
                  <Icon name="psychology_alt" className="text-secondary text-[20px]" />
                  <h3 className="font-title-sm text-title-sm text-text-ivory">{t.dashboard.topics}</h3>
                </div>
                <span role="img" title={t.dashboard.topicsInfo} aria-label={t.dashboard.topicsInfo}>
                  <Icon name="info" className="text-text-muted text-[18px]" />
                </span>
              </div>
              <div className="gap-space-md flex flex-col">
                {shownTopics.length === 0 ? <p className="font-caption text-caption text-text-muted">{t.dashboard.topicsEmpty}</p> : null}
                {shownTopics.map((topic, i) => {
                  const mastered = topic.errorRate === 0 || i === 2;
                  const tone = mastered ? "bg-status-success" : i === 0 ? "bg-status-error" : "bg-primary-container";
                  const text = mastered ? "text-status-success" : i === 0 ? "text-status-error" : "text-primary";
                  const value = mastered ? 100 - topic.errorRate : topic.errorRate;
                  return (
                    <div key={topic.id} className="p-space-sm bg-surface-container-lowest flex flex-col gap-1 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label-sm text-label-sm text-text-ivory truncate">{topic.title}</span>
                        <span className={`font-caption text-caption shrink-0 font-medium ${text}`}>
                          {fill(mastered ? t.dashboard.mastered : t.dashboard.errors, { n: value })}
                        </span>
                      </div>
                      <div className="bg-surface-container-high h-1.5 w-full overflow-hidden rounded-full">
                        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }}></div>
                      </div>
                      <span className="font-caption text-text-muted truncate text-[10px] italic">“{topic.sample}”</span>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={practice}
                disabled={pending || hard.every((x) => x.errorRate === 0)}
                data-action="practice"
                className="bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-sm text-label-sm flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-center transition-colors disabled:opacity-50"
              >
                <Icon name="quiz" className="text-[16px]" />
                <span>{t.dashboard.practice}</span>
              </button>
            </div>

            <div className="bg-surface p-space-md gap-space-sm flex flex-col rounded-xl shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {mode === "live" ? (
                      <span className="bg-status-success absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping"></span>
                    ) : null}
                    <span
                      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${mode === "live" ? "bg-status-success" : "bg-secondary"}`}
                    ></span>
                  </span>
                  <span className="font-label-sm text-label-sm text-text-ivory">{t.dashboard.telegram}</span>
                </div>
                <span
                  className={`font-caption text-caption rounded px-2 py-0.5 ${mode === "live" ? "text-status-success bg-status-success/10" : "text-secondary bg-secondary/10"}`}
                >
                  {mode === "live" ? t.dashboard.telegramLive : t.dashboard.telegramDemo}
                </span>
              </div>
              <div className="gap-space-xs text-caption font-caption text-text-muted grid grid-cols-2 pt-1">
                <div className="bg-surface-container-lowest flex flex-col rounded p-2">
                  <span className="text-text-muted">{t.dashboard.bot}</span>
                  <span className="text-text-ivory font-medium">@QuestlingEnglish_bot</span>
                </div>
                <div className="bg-surface-container-lowest flex flex-col rounded p-2">
                  <span className="text-text-muted">{t.dashboard.entry}</span>
                  <span className="text-text-ivory font-medium">{t.dashboard.entryValue}</span>
                </div>
              </div>
              <p className="font-caption text-caption text-text-muted">{t.dashboard.telegramNote}</p>
            </div>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}

type KpiIcon = "hub" | "menu_book" | "local_fire_department";
type FootIcon = "groups" | "trending_up" | "north_east" | "south_east";

function Kpi(props: {
  label: string;
  value: string;
  icon: KpiIcon;
  iconTone: string;
  left: string;
  right: string;
  rightTone: string;
  foot: string;
  footIcon: FootIcon;
  footTone: string;
}) {
  return (
    <div className="bg-surface p-space-lg group hover:bg-surface-container relative flex flex-col justify-between overflow-hidden rounded-xl shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="font-caption text-caption text-text-muted tracking-wider uppercase">{props.label}</span>
          <span className="font-headline-lg text-headline-lg text-text-ivory mt-1">{props.value}</span>
        </div>
        <div
          className={`bg-surface-container-high flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${props.iconTone}`}
        >
          <Icon name={props.icon} className="text-[22px]" />
        </div>
      </div>
      <div className="mt-space-md pt-space-xs flex flex-col gap-1">
        <div className="font-caption text-caption text-on-surface-variant flex items-center justify-between gap-2">
          <span>{props.left}</span>
          <span className={`shrink-0 font-medium ${props.rightTone}`}>{props.right}</span>
        </div>
        {props.foot ? (
          <div
            className={`font-label-sm text-label-sm flex items-center gap-1 ${props.footTone === "text-primary" ? "text-text-muted" : props.footTone}`}
          >
            <Icon name={props.footIcon} className={`text-[15px] ${props.footTone}`} />
            <span>{props.foot}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A student's hero as a round portrait: the character's own picture, its face in the circle. */
export function Avatar({ characterId, size = "h-9 w-9" }: { characterId: keyof typeof characters | null; size?: string }) {
  const character = characters[characterId ?? "cat"];
  return (
    <span className={`bg-surface-container-high block shrink-0 overflow-hidden rounded-full shadow-sm ${size}`}>
      <img alt="" className="h-full w-full origin-[50%_22%] scale-[1.7] object-cover object-top" src={character.image} />
    </span>
  );
}
