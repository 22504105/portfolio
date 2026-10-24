"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { WEEKLY_CHEST_GOAL } from "@/lib/content/achievements";
import { CHEST_COINS, CHEST_ITEMS, itemById } from "@/lib/content/items";
import { tr } from "@/lib/content/text";
import { useNow, useStudent } from "@/lib/client/student";
import {
  achievementProgress,
  balance,
  chestOpened,
  chestReady,
  currentStreak,
  levelOf,
  owns,
  weeklyQuestCount,
  XP_PER_LEVEL,
} from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { fill, plural } from "@/lib/i18n";
import { BottomNav } from "./bottom-nav";
import { CoinHeader } from "./coin-header";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/10_rewards/code.html.
// The weekly chest opens after five quests in the academy week and gives a random cloak or
// glasses not owned yet, as the export says (owner's decision 2026-10-24), or coins once all
// are owned. Achievements show the student's own progress and are granted automatically.
// Owner's decisions 2026-10-24: the header names the screen (the export said "Profile"), Home's bottom bar.
// Tailwind v3 → v4: shadow-sm → shadow-xs, rounded → rounded-sm, drop-shadow → drop-shadow-sm.

const ACHIEVEMENT_TONE = {
  "first-clue": { icon: "text-status-success", bar: "bg-status-success", reward: "text-primary" },
  "seven-days": { icon: "text-primary", bar: "bg-primary", reward: "text-primary" },
  "moon-library": { icon: "text-secondary", bar: "bg-secondary", reward: "text-secondary" },
  "rune-master": { icon: "text-tertiary", bar: "bg-tertiary", reward: "text-primary" },
} as const;

export function RewardsScreen() {
  const { t, locale, base, facts, act } = useStudent();
  const today = dayOf(useNow());
  const coins = balance(facts, "coins");
  const xp = balance(facts, "xp");
  const { level, into, next } = levelOf(xp);
  const weekly = Math.min(weeklyQuestCount(facts, today), WEEKLY_CHEST_GOAL);
  const ready = chestReady(facts, today);
  const opened = chestOpened(facts, today);
  // The prize is drawn when the chest opens; until then only its kind is known.
  const anyLeft = CHEST_ITEMS.some((id) => !owns(facts, id));
  const progress = achievementProgress(facts);
  const earned = progress.filter((p) => p.earned).length;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [gift, setGift] = useState<string | null>(null);

  function openChest() {
    setError(false);
    startTransition(async () => {
      const result = await act({ type: "openChest" });
      if (!result.ok) return setError(true);
      if (result.outcome.kind === "chest") {
        const item = result.outcome.item ? itemById.get(result.outcome.item) : null;
        setGift(item ? fill(t.rewards.gotItem, { item: tr(item.name, locale) }) : fill(t.rewards.gotCoins, { n: result.outcome.coins }));
      }
    });
  }

  return (
    <div className="bg-background text-text-ivory flex min-h-dvh flex-col">
      <CoinHeader title={t.rewards.title} coins={coins} base={base} t={t} />
      <main className="px-gutter bg-background relative mx-auto flex w-full max-w-md flex-1 flex-col pt-16 pb-24">
        <div className="space-y-space-lg flex w-full flex-col pb-4 select-none">
          <div className="bg-surface-container p-space-md relative overflow-hidden rounded-xl shadow-lg">
            <div className="bg-secondary/10 pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full blur-2xl"></div>
            <div className="bg-primary/10 pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full blur-2xl"></div>
            <div className="gap-space-sm mb-space-md grid grid-cols-2">
              <div className="gap-space-sm bg-surface-container-high/90 px-space-md py-space-sm flex items-center rounded-lg shadow-xs">
                <div className="bg-primary/15 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-[0_0_10px_rgba(228,194,133,0.2)]">
                  <Icon name="monetization_on" filled className="text-[18px]" />
                </div>
                <div className="min-w-0">
                  <span className="font-caption text-caption text-text-muted block leading-none">{t.rewards.treasury}</span>
                  <span className="font-label-md text-label-md text-primary block truncate font-bold tracking-wide">
                    {fill(t.rewards.coins, { n: coins })}
                  </span>
                </div>
              </div>
              <div className="gap-space-sm bg-surface-container-high/90 px-space-md py-space-sm flex items-center rounded-lg shadow-xs">
                <div className="bg-error-container/20 text-status-error flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <Icon name="local_fire_department" filled className="text-[18px]" />
                </div>
                <div className="min-w-0">
                  <span className="font-caption text-caption text-text-muted block leading-none">{t.home.streak}</span>
                  <span className="font-label-md text-label-md text-text-ivory block truncate font-bold">
                    {fill(t.quests.streak, { days: plural(locale, currentStreak(facts, today), t.common.days) })}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-low p-space-md space-y-space-xs rounded-lg">
              <div className="flex items-center justify-between">
                <div className="gap-space-xs flex items-center">
                  <Icon name="workspace_premium" className="text-secondary text-[18px]" />
                  <span className="font-title-sm text-title-sm text-text-ivory font-semibold">{fill(t.quests.level, { n: level })}</span>
                </div>
                <span className="font-caption text-caption text-secondary font-medium tracking-wide">
                  {into} / {next} XP
                </span>
              </div>
              <div
                className="bg-surface-variant h-2.5 w-full overflow-hidden rounded-full p-0.5"
                role="progressbar"
                aria-label={t.home.xp}
                aria-valuemin={0}
                aria-valuemax={XP_PER_LEVEL}
                aria-valuenow={into}
              >
                <div
                  className="from-secondary-container via-secondary to-primary h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(141,117,201,0.5)] transition-all duration-700 ease-out"
                  style={{ width: `${(into / next) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="space-y-space-xs">
            <div className="px-space-xs flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-text-ivory gap-space-xs flex items-center">
                <span>{t.rewards.chestTitle}</span>
              </h2>
              <span className="font-caption text-caption text-primary px-space-sm bg-primary/10 rounded-full py-0.5">
                {t.rewards.weekly}
              </span>
            </div>
            <button
              type="button"
              data-action="open-chest"
              disabled={!ready || pending}
              onClick={openChest}
              className={`bg-surface-container p-space-md relative block w-full overflow-hidden rounded-xl text-left shadow-md ${ready ? "ring-primary/60 ring-1" : ""}`}
            >
              <div className="gap-space-md flex items-start">
                <div className="bg-surface-container-highest relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-inner">
                  <img className="h-full w-full object-cover" alt="" src="/images/glowing-chest.webp" />
                  <div className="from-surface absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-60"></div>
                  <Icon
                    name={ready ? "lock_open" : opened ? "check_circle" : "lock"}
                    className="text-primary absolute right-1 bottom-1 text-[16px] drop-shadow-sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="gap-space-xs mb-1 flex items-center justify-between">
                    <span className="font-label-md text-label-md text-text-ivory font-semibold">{t.rewards.chestName}</span>
                    <span className="font-label-sm text-label-sm text-primary font-bold">
                      {weekly} / {WEEKLY_CHEST_GOAL}
                    </span>
                  </div>
                  <div className="my-1.5 grid grid-cols-5 gap-1">
                    {Array.from({ length: WEEKLY_CHEST_GOAL }, (_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full ${i < weekly ? "bg-primary shadow-[0_0_6px_rgba(228,194,133,0.4)]" : "bg-surface-variant"}`}
                      ></div>
                    ))}
                  </div>
                  <p className="font-caption text-caption text-text-muted mt-1 leading-snug">
                    {opened
                      ? t.rewards.chestOpened
                      : ready
                        ? t.rewards.chestReady
                        : fill(t.rewards.chestLeft, { n: WEEKLY_CHEST_GOAL - weekly })}
                  </p>
                  <div className="mt-space-sm gap-space-xs bg-surface-container-lowest/80 px-space-sm flex items-center rounded-sm py-1">
                    <Icon name="auto_awesome" className="text-tertiary text-[14px]" />
                    <span className="font-caption text-caption text-tertiary truncate">
                      {gift ?? (anyLeft ? t.rewards.prizeRandom : fill(t.rewards.prizeCoins, { n: CHEST_COINS }))}
                    </span>
                  </div>
                </div>
              </div>
            </button>
            {error ? (
              <p role="alert" className="font-caption text-caption text-status-error text-center">
                {t.common.actionFailed}
              </p>
            ) : null}
          </div>

          <div className="space-y-space-sm">
            <div className="px-space-xs flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-text-ivory">{t.rewards.achievements}</h2>
              <span className="font-caption text-caption text-text-muted">
                {fill(t.rewards.opened, { n: earned, total: progress.length })}
              </span>
            </div>
            <div className="space-y-space-xs">
              {progress.map(({ achievement, value, earned: isEarned }) => {
                const tone = ACHIEVEMENT_TONE[achievement.id];
                const reward = "coins" in achievement.reward ? null : itemById.get(achievement.reward.item);
                return (
                  <div
                    key={achievement.id}
                    data-achievement={achievement.id}
                    data-earned={isEarned}
                    className="bg-surface-container p-space-md relative overflow-hidden rounded-xl shadow-xs transition-transform active:scale-[0.99]"
                  >
                    {isEarned ? <div className="bg-status-success absolute top-0 bottom-0 left-0 w-1"></div> : null}
                    <div className="gap-space-md flex items-start">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                          isEarned
                            ? "bg-status-success/15 text-status-success shadow-[0_0_12px_rgba(99,186,158,0.25)]"
                            : `bg-surface-container-high shadow-xs ${tone.icon}`
                        }`}
                      >
                        <Icon name={achievement.icon} className="text-[24px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-title-sm text-title-sm text-text-ivory truncate font-semibold">
                            {tr(achievement.title, locale)}
                          </h3>
                          {isEarned ? (
                            <span className="font-caption text-caption text-status-success bg-status-success/10 flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 font-medium">
                              <Icon name="check" className="text-[12px]" /> {t.quests.done}
                            </span>
                          ) : (
                            <span className="font-caption text-caption text-text-muted flex shrink-0 items-center gap-0.5">
                              {value} / {achievement.goal} <Icon name="lock" className="text-[13px]" />
                            </span>
                          )}
                        </div>
                        <p className="font-body-md text-body-md text-text-muted mt-0.5 line-clamp-1">
                          {tr(achievement.description, locale)}
                        </p>
                        {isEarned ? (
                          <div className="mt-space-xs gap-space-xs flex items-center">
                            <Icon name={reward ? "crown" : "monetization_on"} className="text-primary text-[14px]" />
                            <span className="font-caption text-caption text-primary font-semibold">
                              {reward
                                ? fill(t.rewards.itemReceived, { item: tr(reward.name, locale) })
                                : fill(t.rewards.coinsReceived, { n: "coins" in achievement.reward ? achievement.reward.coins : 0 })}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-space-xs gap-space-sm flex items-center">
                            <div className="bg-surface-variant h-1.5 flex-1 overflow-hidden rounded-full">
                              <div
                                className={`h-full rounded-full ${tone.bar}`}
                                style={{ width: `${(value / achievement.goal) * 100}%` }}
                              ></div>
                            </div>
                            <div className={`flex items-center gap-0.5 ${tone.reward}`}>
                              <Icon name={reward ? "crown" : "monetization_on"} className="text-[13px]" />
                              <span className="font-caption text-caption font-bold">
                                {reward ? `«${tr(reward.name, locale)}»` : "coins" in achievement.reward ? achievement.reward.coins : ""}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-container-low/70 p-space-sm gap-space-sm text-text-muted flex items-center rounded-lg">
            <Icon name="info" className="text-tertiary shrink-0 text-[16px]" />
            <p className="font-caption text-caption leading-tight">{t.rewards.notice}</p>
          </div>
        </div>
      </main>
      <BottomNav base={base} active="profile" labels={t.nav} position="screen" />
    </div>
  );
}
