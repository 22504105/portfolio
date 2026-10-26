"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { DAILY_BONUS, type QuickQuest } from "@/lib/content/quick-quests";
import { tr } from "@/lib/content/text";
import { useNow, useStudent } from "@/lib/client/student";
import {
  assignedQuests,
  balance,
  completed,
  currentStreak,
  dailyQuests,
  levelOf,
  questRef,
  questsCompletedOn,
  runState,
} from "@/lib/game/stats";
import { dayOf, msUntilNextDay } from "@/lib/game/time";
import { worldOf } from "@/lib/game/world";
import { fill, plural } from "@/lib/i18n";
import { BottomNav } from "./bottom-nav";
import { CoinHeader } from "./coin-header";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/08_quick_quests/code.html.
// Today's three daily quests come from the academy's rotation, the mentor's from assignments
// (the demo has one; real ones arrive with Teacher Studio). Statuses and progress are the
// student's own; the reward for finishing all three is the day's bonus (lib/game/ops.ts).
// Owner's decisions 2026-10-24: the header names the screen, Home's bottom bar.
// Tailwind v3 → v4: shadow-sm → shadow-xs, shadow → shadow-sm.

type Filter = "all" | "today" | "mentor" | "grammar";

export function QuestsScreen() {
  const { t, locale, base, facts, mode } = useStudent();
  const now = useNow();
  const today = dayOf(now);
  const [filter, setFilter] = useState<Filter>("all");
  const daily = dailyQuests(today);
  const assigned = assignedQuests(facts, mode === "demo");
  const done = questsCompletedOn(facts, today);
  const percent = Math.round((done / daily.length) * 100);
  const left = msUntilNextDay(now);
  const xp = balance(facts, "xp");
  const { level } = levelOf(xp);
  const all = [...daily, ...assigned];
  const picked =
    filter === "today" ? daily : filter === "mentor" ? assigned : filter === "grammar" ? all.filter((q) => q.skill === "grammar") : all;
  // Finished quests go to the end: what is still to do comes first.
  const shown = [...picked].sort(
    (a, b) => Number(completed(facts, "quest", questRef(a, today))) - Number(completed(facts, "quest", questRef(b, today))),
  );

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: t.quests.all },
    { id: "today", label: t.quests.today, count: daily.length },
    { id: "mentor", label: fill(t.quests.mentor, { cefr: "A2" }) },
    { id: "grammar", label: t.quests.grammar },
  ];

  return (
    <div className="bg-background text-text-ivory flex min-h-dvh flex-col">
      <CoinHeader title={t.quests.title} coins={balance(facts, "coins")} base={base} t={t} />
      <main className="px-gutter bg-background relative mx-auto flex w-full max-w-md flex-1 flex-col pt-16 pb-24">
        <div className="space-y-space-lg flex w-full flex-col pb-8">
          <div className="bg-surface-container px-space-md py-space-sm flex items-center justify-between rounded-xl shadow-md">
            <div className="gap-space-sm flex items-center">
              <div className="bg-secondary-container relative flex h-8 w-8 items-center justify-center rounded-full shadow-[0_0_12px_rgba(141,117,201,0.35)]">
                <span className="font-headline-md text-headline-md text-secondary">{level}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-caption text-caption text-text-muted">{t.quests.rank}</span>
                <span className="font-label-md text-label-md text-text-ivory leading-tight">{fill(t.quests.level, { n: level })}</span>
              </div>
            </div>
            <Link
              href={`${base}/rewards`}
              className="bg-surface-container-high px-space-md flex items-center gap-1.5 rounded-full py-1 shadow-[0_0_14px_rgba(228,194,133,0.2)]"
            >
              <Icon name="local_fire_department" filled className="text-primary text-[20px]" />
              <span className="font-label-md text-label-md text-primary font-bold">
                {fill(t.quests.streak, { days: plural(locale, currentStreak(facts, today), t.common.days) })}
              </span>
            </Link>
          </div>

          <div className="space-y-space-xs flex flex-col">
            <div className="gap-space-xs text-primary flex items-center">
              <Icon name="hourglass_top" className="text-[18px]" />
              <span className="font-label-sm text-label-sm text-primary tracking-widest uppercase">{t.quests.kicker}</span>
            </div>
            <h2 className="font-headline-xl-mobile text-headline-xl-mobile text-text-ivory tracking-tight">{t.quests.heading}</h2>
            <p className="font-body-md text-body-md text-text-muted">{t.quests.lead}</p>
          </div>

          <div className="bg-surface p-space-md space-y-space-sm relative overflow-hidden rounded-xl shadow-md">
            <div className="bg-primary/5 pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full blur-xl"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="gap-space-xs flex items-center">
                <Icon name="task_alt" className="text-primary text-[20px]" />
                <span className="font-label-md text-label-md text-text-ivory">
                  {fill(t.quests.doneOf, { n: done, total: daily.length })}
                </span>
              </div>
              <span className="font-label-md text-label-md text-primary font-bold">{percent}%</span>
            </div>
            <div
              className="bg-surface-container-lowest relative h-2 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={daily.length}
              aria-valuenow={done}
              aria-label={t.quests.heading}
            >
              <div
                className="from-primary-container via-primary to-primary-fixed h-full rounded-full bg-gradient-to-r shadow-[0_0_10px_rgba(228,194,133,0.4)] transition-all duration-500"
                style={{ width: `${percent}%` }}
              ></div>
            </div>
            <div className="text-text-muted font-caption text-caption flex items-center justify-between pt-0.5">
              <span>{fill(t.quests.bonus, { xp: DAILY_BONUS.xp, coins: DAILY_BONUS.coins })}</span>
              <span className="text-tertiary">
                {fill(t.quests.renews, { h: Math.floor(left / 3_600_000), m: Math.floor((left % 3_600_000) / 60_000) })}
              </span>
            </div>
          </div>

          <div
            className="gap-space-xs -mx-gutter px-gutter flex items-center overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
            role="tablist"
          >
            {filters.map((option) => {
              const active = option.id === filter;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(option.id)}
                  className={
                    active
                      ? "px-space-md bg-primary text-on-primary font-label-sm text-label-sm flex items-center gap-1 rounded-full py-1.5 whitespace-nowrap shadow-[0_0_12px_rgba(228,194,133,0.3)] transition-transform active:scale-95"
                      : option.count
                        ? "px-space-md bg-surface-container-high text-text-ivory hover:text-primary font-label-sm text-label-sm flex items-center gap-1 rounded-full py-1.5 whitespace-nowrap shadow-xs transition-transform active:scale-95"
                        : "px-space-md bg-surface-container text-text-muted hover:text-text-ivory font-label-sm text-label-sm rounded-full py-1.5 whitespace-nowrap shadow-xs transition-transform active:scale-95"
                  }
                >
                  <span>{option.label}</span>
                  {option.count ? (
                    <span className="bg-primary-container text-on-primary-container flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                      {option.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <p className="bg-surface p-space-md font-body-md text-body-md text-text-muted rounded-xl text-center shadow-md">
              {filter === "mentor" ? t.quests.noAssigned : t.quests.none}
            </p>
          ) : (
            shown.map((quest, i) => <QuestCard key={quest.id} quest={quest} today={today} featured={i === 0 && filter === "all"} />)
          )}
        </div>
        <DubList />
      </main>
      <BottomNav base={base} active="quests" labels={t.nav} position="screen" />
    </div>
  );
}

function QuestCard({ quest, today, featured }: { quest: QuickQuest; today: string; featured: boolean }) {
  const { t, locale, base, facts } = useStudent();
  const ref = questRef(quest, today);
  const run = runState(facts, quest, ref);
  const isDone = completed(facts, "quest", ref);
  const inProgress = run.started && !isDone;
  const assigned = quest.audience === "assigned";
  const listening = quest.skill === "listening";
  const href = `${base}/quests/${quest.id}`;
  const topicTone = quest.tone === "gold" ? "text-primary" : assigned ? "text-tertiary" : "text-secondary";

  const status = isDone ? (
    <span className="bg-status-success/15 text-status-success font-caption text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5">
      <Icon name="check_circle" className="text-[12px]" />
      {t.quests.done}
    </span>
  ) : assigned ? (
    <span className="bg-primary/20 text-primary font-caption text-caption inline-flex max-w-[170px] items-center gap-1 truncate rounded-full px-2 py-0.5">
      <Icon name="verified" className="text-[12px]" />
      {fill(t.quests.fromTeacher, { group: t.quests.demoGroup })}
    </span>
  ) : inProgress ? (
    <span className="bg-secondary-container text-on-secondary-container font-caption text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5">
      <span className="bg-secondary h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"></span>
      {fill(t.quests.inProgress, { n: run.current, total: quest.questions.length })}
    </span>
  ) : (
    <span className="bg-surface-container-high text-text-muted font-caption text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5">
      <span className="bg-tertiary h-1.5 w-1.5 rounded-full"></span>
      {t.quests.notStarted}
    </span>
  );

  return (
    <div
      className="bg-surface p-space-md space-y-space-md relative overflow-hidden rounded-xl shadow-md transition-all active:scale-[0.99]"
      data-quest={quest.id}
    >
      {featured ? <div className="bg-primary/10 pointer-events-none absolute top-0 right-0 h-36 w-36 rounded-full blur-2xl"></div> : null}
      <div className="gap-space-md relative z-10 flex items-start">
        <div
          className={`bg-surface-container-lowest relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
            quest.tone === "gold" ? "shadow-[0_0_16px_rgba(185,154,97,0.25)]" : "shadow-[0_0_16px_rgba(141,117,201,0.25)]"
          }`}
        >
          <img alt={tr(quest.title, locale)} className="h-full w-full object-cover" src={quest.image} />
          <div className="from-surface-container-lowest/70 absolute inset-0 bg-gradient-to-t via-transparent to-transparent"></div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-1">
            {status}
            <span className="font-label-sm text-label-sm text-primary flex shrink-0 items-center gap-0.5 font-semibold">
              <Icon name="stars" className="text-[15px]" />+{quest.xp} XP
            </span>
          </div>
          <h3 className="font-title-sm text-title-sm text-text-ivory truncate pt-0.5">«{tr(quest.title, locale)}»</h3>
          <p className={`font-caption text-caption ${topicTone}`}>{tr(quest.topic, locale)}</p>
          <div className="gap-space-sm text-text-muted font-caption text-caption flex items-center pt-1">
            <span className="flex items-center gap-0.5">
              <Icon name={listening ? "headphones" : "schedule"} className="text-[14px]" /> {fill(t.quests.minutes, { n: quest.minutes })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-0.5">
              <Icon name="school" className="text-[14px]" /> {fill(t.quests.cefr, { cefr: quest.cefr })}
            </span>
            <span>•</span>
            <span className="text-primary flex items-center gap-0.5 font-medium">
              <Icon name="monetization_on" className="text-[14px]" /> {quest.coins}
            </span>
          </div>
        </div>
      </div>

      {inProgress ? (
        <div className="space-y-space-xs pt-1">
          <div className="text-caption font-caption text-text-muted flex items-center justify-between">
            <span>{fill(t.quests.step, { n: run.current, total: quest.questions.length })}</span>
            <span className="text-secondary font-medium">{Math.round((run.current / quest.questions.length) * 100)}%</span>
          </div>
          <div className="bg-surface-container-lowest h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-secondary h-full rounded-full shadow-[0_0_8px_rgba(208,188,255,0.4)]"
              style={{ width: `${(run.current / quest.questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      ) : null}

      {quest.teaser && !isDone ? (
        <div className="bg-surface-container-low px-space-md py-space-sm gap-space-sm flex items-center rounded-lg">
          <Icon name="graphic_eq" className="text-primary text-[20px]" />
          <p className="font-caption text-caption text-text-muted truncate italic">«{quest.teaser}»</p>
        </div>
      ) : null}

      {isDone ? (
        <div className="bg-surface-container text-status-success font-label-md text-label-md flex h-11 w-full items-center justify-center gap-2 rounded-lg uppercase">
          <Icon name="task_alt" className="text-[18px]" />
          <span>{t.quests.completed}</span>
        </div>
      ) : inProgress || listening ? (
        <Link
          href={href}
          className="bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md flex h-11 w-full items-center justify-center gap-2 rounded-lg uppercase shadow-xs transition-colors active:scale-[0.98]"
        >
          <Icon
            name={inProgress ? "play_arrow" : "headphones"}
            className={`text-[18px] ${inProgress ? "text-secondary" : "text-primary"}`}
          />
          <span>{inProgress ? t.quests.continue : t.quests.listen}</span>
        </Link>
      ) : (
        <Link
          href={href}
          className="font-label-md text-label-md flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] tracking-wider text-[#101016] uppercase shadow-[0_0_16px_rgba(185,154,97,0.3)] transition-transform active:scale-[0.98]"
        >
          <span>{t.quests.start}</span>
          <Icon name="arrow_forward" className="text-[18px]" />
        </Link>
      )}
    </div>
  );
}

/** Voice-acting scenes the student was given (lib/dub/model.ts), with where each stands; none, nothing shown. */
function DubList() {
  const { t, base, facts } = useStudent();
  const dubs = worldOf(facts).dubs ?? [];
  if (!dubs.length) return null;
  return (
    <section className="mt-space-lg gap-space-sm flex flex-col" data-dub-list>
      <div className="flex flex-col gap-0.5 px-1">
        <h2 className="font-headline-md text-headline-md text-text-ivory">{t.dub.list}</h2>
        <p className="font-caption text-caption text-text-muted">{t.dub.listNote}</p>
      </div>
      {dubs.map((dub) => {
        const own = facts.dubs?.find((d) => d.exercise === dub.exercise && d.version === dub.version);
        const status = own?.status ?? "none";
        return (
          <Link
            key={dub.exercise}
            href={`${base}/dub/${dub.exercise}`}
            data-dub-card={dub.exercise}
            className="bg-surface p-space-md hover:bg-surface-container-high flex items-center justify-between gap-3 rounded-xl shadow-md transition-colors"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-title-sm text-title-sm text-text-ivory truncate">{dub.content.title}</span>
              <span
                className={`font-caption text-caption ${status === "approved" ? "text-status-success" : status === "retry" ? "text-status-error" : "text-text-muted"}`}
              >
                CEFR {dub.content.cefr} · {t.dub.statuses[status]} · +{dub.content.xp} XP
              </span>
            </span>
            <Icon name="mic" className="text-primary shrink-0 text-[24px]" />
          </Link>
        );
      })}
    </section>
  );
}
