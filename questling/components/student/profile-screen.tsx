/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { fill, getDictionary, plural, type Locale } from "@/lib/i18n";
import { xpPercent } from "@/lib/student/home";
import type { ProfileView } from "@/lib/student/profile";
import { BottomNav } from "./bottom-nav";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/11_profile_2/code.html.
// Owner's decisions (2026-10-24): the header names the screen in the interface language
// (the export says "Profile"), and the bottom bar is Home's, as on every main screen.
// Tailwind v3 → v4 renames: shadow-sm → shadow-xs, blur-sm → blur-xs.

type QuickLinkIcon = "checkroom" | "backpack" | "account_balance" | "settings";

const skillTones = {
  primary: { badge: "bg-primary/10 text-primary", value: "text-primary", bar: "bg-primary shadow-[0_0_6px_rgba(228,194,133,0.4)]" },
  secondary: {
    badge: "bg-secondary/15 text-[#d0bcff]",
    value: "text-[#d0bcff]",
    bar: "bg-secondary shadow-[0_0_6px_rgba(141,117,201,0.5)]",
  },
  success: {
    badge: "bg-status-success/10 text-status-success",
    value: "text-status-success",
    bar: "bg-status-success shadow-[0_0_6px_rgba(99,186,158,0.4)]",
  },
  tertiary: { badge: "bg-tertiary/10 text-tertiary", value: "text-tertiary", bar: "bg-tertiary shadow-[0_0_6px_rgba(217,196,155,0.4)]" },
};

export function ProfileScreen({ view, base, locale }: { view: ProfileView; base: string; locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <div data-scope="profile" className="bg-background text-text-ivory flex min-h-dvh flex-col">
      <header className="pt-safe fixed inset-x-0 top-0 z-50 border-b border-[#6E5A3A]/20 bg-[#1C1B27]/90 shadow-[0_1px_8px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="px-gutter mx-auto flex h-16 w-full max-w-md items-center justify-between">
          <div className="gap-space-sm flex items-center">
            <div className="bg-surface-container-high text-primary flex h-9 w-9 items-center justify-center rounded-full">
              <Icon name="auto_stories" className="text-[20px]" />
            </div>
            <h1 className="font-headline-md text-headline-md text-text-ivory tracking-tight">{t.profile.title}</h1>
          </div>
          <div className="gap-space-md flex items-center">
            <div className="gap-space-xs bg-surface-container-high px-space-md flex items-center rounded-full border border-[#6E5A3A]/30 py-1 shadow-[0_0_12px_rgba(185,154,97,0.15)]">
              <Icon name="monetization_on" className="text-primary text-[18px]" />
              <span className="font-label-md text-label-md text-primary font-bold">{view.coins}</span>
            </div>
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full shadow-[0_0_8px_rgba(228,194,133,0.3)]">
              <Icon name="person" className="text-on-primary text-[18px]" />
            </div>
          </div>
        </div>
      </header>

      <main className="px-gutter bg-background relative mx-auto flex w-full max-w-md flex-1 flex-col pt-16 pb-24">
        <div className="gap-space-lg flex w-full flex-col">
          <div className="p-space-lg relative overflow-hidden rounded-xl border border-[#6E5A3A]/30 bg-[#1C1B27] shadow-2xl">
            <div className="pointer-events-none absolute -top-12 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#8D75C9]/15 blur-3xl"></div>
            <div className="pointer-events-none absolute right-0 bottom-10 h-44 w-44 rounded-full bg-[#B99A61]/15 blur-2xl"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="flex items-center gap-2">
                {/* Renaming arrives with accounts (Gate 2); in the demo the pencil only shows where it will be. */}
                <div className="bg-surface-container-low/90 flex items-center gap-1.5 rounded-full border border-[#6E5A3A]/40 px-3 py-1">
                  <span className="font-headline-md text-headline-md text-text-ivory">{view.name}</span>
                  <Icon name="edit" className="text-primary text-[16px]" />
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="bg-secondary-container/40 inline-flex items-center gap-1 rounded-full border border-[#8D75C9]/40 px-2.5 py-0.5 shadow-[0_0_10px_rgba(141,117,201,0.2)]">
                  <Icon name="star" filled className="text-primary text-[13px]" />
                  <span className="font-label-sm text-caption font-semibold tracking-wide text-[#d0bcff]">
                    {fill(t.profile.level, { level: view.level, school: view.school })}
                  </span>
                </div>
                <span className="text-caption text-text-muted">•</span>
                <span className="font-title-sm text-primary text-[13px] tracking-wide">{view.title}</span>
              </div>
            </div>

            <div className="relative z-10 my-2 flex flex-col items-center justify-center">
              <div className="relative flex h-72 w-64 items-center justify-center">
                <div className="absolute inset-4 rounded-full bg-gradient-to-b from-[#8D75C9]/25 via-[#B99A61]/20 to-transparent blur-xl"></div>
                <img
                  alt={view.name}
                  className="relative z-10 h-full w-auto object-contain drop-shadow-[0_0_20px_rgba(141,117,201,0.35)] drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] filter"
                  src={view.image}
                />
                <div className="pointer-events-none absolute -bottom-2 flex h-9 w-52 items-center justify-center rounded-[50%] border-t-2 border-[#e4c285] bg-gradient-to-r from-transparent via-[#8D75C9]/60 to-transparent shadow-[0_0_25px_rgba(228,194,133,0.5)]">
                  <div className="h-5 w-40 rounded-[50%] bg-[#B99A61]/25 blur-xs"></div>
                </div>
              </div>
              <div className="mt-2 flex max-w-xs flex-wrap items-center justify-center gap-1.5">
                {view.gear.map((item) => (
                  <span
                    key={item.id}
                    className="text-text-ivory text-caption inline-flex items-center gap-1 rounded-full border border-[#6E5A3A]/40 bg-[#1b1b21] px-2.5 py-1 font-medium shadow-xs"
                  >
                    <Icon name={item.icon} className={`text-[13px] ${item.tone === "violet" ? "text-[#d0bcff]" : "text-primary"}`} />
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-space-sm bg-surface-container-low/70 p-space-sm relative z-10 mt-3 w-full rounded-lg border border-[#6E5A3A]/20">
              <div className="text-caption font-label-sm mb-1.5 flex items-center justify-between px-1">
                <span className="text-primary font-semibold tracking-wider uppercase">{view.xp.label}</span>
                <span className="text-text-muted">
                  {view.xp.current} / {view.xp.next} XP
                </span>
              </div>
              <div
                className="bg-surface-container-highest h-2 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-label={view.xp.label}
                aria-valuemin={0}
                aria-valuemax={view.xp.next}
                aria-valuenow={view.xp.current}
              >
                <div
                  className="from-primary-container via-primary to-secondary h-full rounded-full bg-gradient-to-r shadow-[0_0_8px_rgba(228,194,133,0.5)]"
                  style={{ width: `${xpPercent(view.xp.current, view.xp.next)}%` }}
                ></div>
              </div>
            </div>

            <div className="gap-space-sm mt-space-sm relative z-10 grid w-full grid-cols-2">
              <div className="bg-surface-container-high/60 flex items-center justify-center gap-2 rounded-lg border border-[#6E5A3A]/20 px-3 py-2">
                <Icon name="monetization_on" filled className="text-primary text-[20px]" />
                <div className="flex flex-col text-left">
                  <span className="font-label-md text-label-md text-text-ivory font-bold">{view.coins}</span>
                  <span className="font-caption text-caption text-text-muted">{t.profile.goldUnit}</span>
                </div>
              </div>
              <div className="bg-surface-container-high/60 flex items-center justify-center gap-2 rounded-lg border border-[#6E5A3A]/20 px-3 py-2">
                <Icon name="local_fire_department" filled className="text-status-error text-[20px]" />
                <div className="flex flex-col text-left">
                  <span className="font-label-md text-label-md text-text-ivory font-bold">
                    {plural(locale, view.streakDays, t.common.days)}
                  </span>
                  <span className="font-caption text-caption text-text-muted">{t.profile.streakUnit}</span>
                </div>
              </div>
            </div>
          </div>

          <section className="gap-space-sm flex flex-col">
            <div className="flex items-baseline justify-between px-1">
              <div className="flex items-center gap-1.5">
                <Icon name="auto_stories" className="text-primary text-[18px]" />
                <h2 className="font-headline-md text-headline-md text-text-ivory">{t.profile.progress}</h2>
              </div>
              <span className="font-label-sm text-caption bg-secondary-container/40 text-secondary rounded-full border border-[#8D75C9]/30 px-2.5 py-0.5 font-semibold tracking-wider uppercase">
                CEFR {view.cefr}
              </span>
            </div>
            <div className="gap-space-xs bg-surface p-space-md flex flex-col rounded-xl border border-[#6E5A3A]/20 shadow-lg">
              {view.skills.map((skill) => {
                const tone = skillTones[skill.tone];
                return (
                  <div
                    key={skill.id}
                    className="p-space-sm bg-surface-container-low/70 flex flex-col gap-1.5 rounded-lg border border-[#6E5A3A]/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${tone.badge}`}>
                          <Icon name={skill.icon} className="text-[16px]" />
                        </div>
                        <div>
                          <div className="font-label-md text-label-md text-text-ivory">{skill.name}</div>
                          <div className="font-caption text-caption text-text-muted">{skill.detail}</div>
                        </div>
                      </div>
                      <span className={`font-label-md text-label-md font-bold ${tone.value}`}>{skill.percent}%</span>
                    </div>
                    <div className="bg-surface-container-highest h-1.5 w-full overflow-hidden rounded-full">
                      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${skill.percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              <div className="pt-space-xs text-caption text-text-muted flex items-center justify-center gap-1.5 italic opacity-75">
                <Icon name="info" className="text-[13px]" />
                <span>{t.profile.demoData}</span>
              </div>
            </div>
          </section>

          <section className="gap-space-sm flex flex-col">
            <div className="flex items-center gap-1.5 px-1">
              <Icon name="explore" className="text-primary text-[18px]" />
              <h2 className="font-headline-md text-headline-md text-text-ivory">{t.profile.quickAccess}</h2>
            </div>
            <div className="gap-space-xs flex flex-col">
              <QuickLink href={`${base}/wardrobe`} icon="checkroom" title={t.profile.wardrobe} note={view.wardrobeNote} />
              <QuickLink href={`${base}/inventory`} icon="backpack" title={t.profile.inventory} note={view.inventoryNote} />
              <QuickLink
                href={`${base}/group`}
                icon="account_balance"
                violet
                title={fill(t.profile.group, { name: view.group.name })}
                note={fill(t.profile.mentor, { name: view.group.mentor })}
              />
              <QuickLink
                href={`${base}/settings`}
                icon="settings"
                title={t.profile.settings}
                note={fill(t.profile.linkedAccount, { username: view.telegram.username, id: view.telegram.id })}
              />
            </div>
          </section>
        </div>
      </main>

      <BottomNav base={base} active="profile" labels={t.nav} position="screen" />
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  note,
  violet = false,
}: {
  href: string;
  icon: QuickLinkIcon;
  title: string;
  note: string;
  violet?: boolean;
}) {
  return (
    <Link
      href={href}
      className="p-space-md bg-surface hover:bg-surface-container-high group flex items-center justify-between rounded-xl border border-[#6E5A3A]/20 shadow-md transition-all active:scale-[0.99]"
    >
      <div className="gap-space-md flex min-w-0 items-center">
        <div
          className={
            violet
              ? "bg-secondary-container/40 text-secondary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors"
              : "bg-surface-container-high group-hover:bg-primary/20 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors"
          }
        >
          <Icon name={icon} className="text-[22px]" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span
            className={`font-label-md text-label-md text-text-ivory truncate transition-colors ${violet ? "group-hover:text-secondary" : "group-hover:text-primary"}`}
          >
            {title}
          </span>
          <span className="font-caption text-caption text-text-muted truncate">{note}</span>
        </div>
      </div>
      <Icon
        name="chevron_right"
        className={`text-text-muted ml-2 flex-shrink-0 text-[20px] transition-all group-hover:translate-x-0.5 ${violet ? "group-hover:text-secondary" : "group-hover:text-primary"}`}
      />
    </Link>
  );
}
