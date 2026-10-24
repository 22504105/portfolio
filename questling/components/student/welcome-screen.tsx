"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useStudent } from "@/lib/client/student";
import { setSound, useSoundOn } from "@/lib/client/sound";
import { LOCALES, switchLocalePath } from "@/lib/i18n";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/01_welcome/code.html.
// The language pill switches the interface language (owner's decision 2026-10-24); the sound
// button switches reading aloud on and off. The cat in the circle is the academy's guide,
// not the student's hero, so it stays the same whoever plays.
// Tailwind v3 → v4: drop-shadow-sm → drop-shadow-xs.

export function WelcomeScreen() {
  const { t, locale, base, facts } = useStudent();
  const pathname = usePathname();
  const soundOn = useSoundOn();
  const other = LOCALES.find((option) => option !== locale) ?? locale;
  // Someone who has a hero already goes straight home; a newcomer chooses one first.
  const start = facts.profile.characterId ? `${base}/home` : `${base}/character`;

  return (
    <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased">
      <main className="pt-safe pb-safe bg-background mx-auto flex w-full max-w-[420px] flex-1 flex-col">
        <div className="px-margin pb-space-xl relative flex w-full flex-col overflow-hidden">
          <div className="-mx-margin px-margin relative mb-[-80px] h-72 w-full overflow-hidden">
            <img
              alt=""
              className="h-full w-full translate-y-[-10px] scale-105 transform object-cover object-top opacity-60 mix-blend-screen"
              src="/images/forgotten-tower.webp"
            />
            <div className="from-background via-background/70 absolute inset-0 bg-gradient-to-t to-transparent"></div>
            <div className="from-background/90 absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent"></div>
            <div className="top-space-sm inset-x-margin absolute z-20 flex items-center justify-between">
              <div className="gap-space-xs bg-surface/80 px-space-md flex items-center rounded-full py-1 shadow-md backdrop-blur-md">
                <span className="bg-status-success h-2 w-2 rounded-full shadow-[0_0_8px_rgba(99,186,158,0.8)]"></span>
                <span className="font-label-sm text-label-sm text-text-ivory tracking-wider uppercase">A1 — B2</span>
              </div>
              <div className="gap-space-sm flex items-center">
                <button
                  type="button"
                  aria-label={t.welcome.sound}
                  aria-pressed={soundOn}
                  onClick={() => setSound(!soundOn)}
                  className="bg-surface/80 text-primary hover:text-text-ivory flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur-md transition-all active:scale-95"
                >
                  <Icon name={soundOn ? "volume_up" : "volume_off"} className="text-[19px]" />
                </button>
                <Link
                  href={switchLocalePath(pathname, other)}
                  replace
                  aria-label={t.welcome.switchLanguage}
                  className="px-space-md bg-surface/80 text-text-ivory font-label-sm text-label-sm hover:text-primary flex h-9 items-center gap-1 rounded-full shadow-md backdrop-blur-md transition-all active:scale-95"
                >
                  <span>{locale.toUpperCase()}</span>
                  <Icon name="expand_more" className="text-text-muted text-[15px]" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mb-space-sm relative z-10 mt-2 flex flex-col items-center text-center">
            <div className="gap-space-xs text-primary mb-1 flex items-center">
              <span className="text-[12px] opacity-75">✦</span>
              <span className="font-label-sm text-label-sm text-primary tracking-[0.28em] uppercase">Academy of Whispers</span>
              <span className="text-[12px] opacity-75">✦</span>
            </div>
            <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-text-ivory tracking-wide drop-shadow-[0_2px_12px_rgba(228,194,133,0.35)]">
              QUESTLING
            </h1>
            <p className="font-headline-md text-headline-md text-primary-fixed-dim -mt-1 italic drop-shadow-xs">
              Learn English Through Adventure
            </p>
            <div className="via-primary-container my-space-sm h-[1px] w-24 bg-gradient-to-r from-transparent to-transparent"></div>
            <p className="font-body-md text-body-md text-text-muted px-space-xs max-w-[320px] leading-relaxed">{t.welcome.lead}</p>
          </div>

          <div className="my-space-xs relative z-10 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="bg-secondary-container/25 absolute h-48 w-48 rounded-full blur-2xl motion-safe:animate-pulse"></div>
              <div className="bg-primary-container/20 absolute h-36 w-36 rounded-full blur-xl"></div>
              <div className="from-primary/20 to-secondary/30 absolute -inset-1 rounded-full bg-gradient-to-t via-transparent blur-md"></div>
              <div className="from-primary via-surface-container to-secondary-container/60 relative flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-b p-1 shadow-[0_0_24px_rgba(141,117,201,0.35)]">
                <div className="bg-surface-container-lowest flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                  <img
                    alt={t.welcome.guide}
                    className="h-full w-full translate-y-1 scale-110 transform object-cover transition-transform duration-500 hover:scale-125"
                    src="/images/hero-cat-wizard.webp"
                  />
                </div>
              </div>
              <div className="bg-surface-container-high/95 px-space-md absolute -bottom-2 flex items-center gap-1.5 rounded-full py-1 shadow-lg backdrop-blur-md">
                <Icon name="auto_awesome" filled className="text-primary text-[15px]" />
                <span className="font-label-sm text-label-sm text-text-ivory font-medium">{t.welcome.guide}</span>
              </div>
            </div>
          </div>

          <div className="gap-space-sm mt-space-md mb-space-lg relative z-10 flex flex-col">
            <Feature icon="hourglass_top" tone="text-primary" title={t.welcome.quickTitle} text={t.welcome.quickText} />
            <Feature icon="menu_book" tone="text-secondary" title={t.welcome.storyTitle} text={t.welcome.storyText} />
            <Feature icon="military_tech" tone="text-status-success" title={t.welcome.levelsTitle} text={t.welcome.levelsText} />
          </div>

          <div className="gap-space-md relative z-10 mt-auto flex flex-col items-center">
            <Link
              href={start}
              className="group to-primary-container text-surface-container-lowest font-label-md text-label-md gap-space-sm flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#D5B87E] tracking-wider uppercase shadow-[0_0_20px_rgba(185,154,97,0.35)] transition-all active:scale-[0.98]"
            >
              <span className="text-[15px] font-semibold">{t.welcome.start}</span>
              <Icon name="arrow_forward" className="text-[20px] transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <div className="gap-space-xs text-text-muted font-caption text-caption flex items-center text-center">
              <svg className="text-secondary h-3.5 w-3.5 shrink-0 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"></path>
              </svg>
              <span>{t.welcome.telegram}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

type FeatureIcon = "hourglass_top" | "menu_book" | "military_tech";

function Feature({ icon, tone, title, text }: { icon: FeatureIcon; tone: string; title: string; text: string }) {
  return (
    <div className="gap-space-md p-space-md bg-surface flex items-center rounded-xl shadow-md">
      <div className={`bg-surface-container-high flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-inner ${tone}`}>
        <Icon name={icon} className="text-[22px]" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="font-title-sm text-title-sm text-text-ivory">{title}</span>
        <span className="font-caption text-caption text-text-muted">{text}</span>
      </div>
      <div className={`ml-auto shrink-0 text-xs opacity-75 ${tone}`}>✦</div>
    </div>
  );
}
