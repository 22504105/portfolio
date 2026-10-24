"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useStudent } from "@/lib/client/student";
import { fill, LOCALES, switchLocalePath, type Locale } from "@/lib/i18n";
import { BackHeader } from "./back-header";
import { BottomNav } from "./bottom-nav";

// Settings, opened from the profile's "Настройки и Telegram ID" row. No Stitch screen exists for it,
// so it is built only from pieces of the approved ones (owner's rule: no new design): the
// story player's header, the profile's section headings, quick-access rows and demo note,
// and the story player's radio dot for the chosen language.

const nativeNames: Record<Locale, string> = { ru: "Русский", en: "English" };

export function SettingsScreen() {
  const { t, locale, base, account } = useStudent();
  const path = usePathname();
  const telegram = account.telegram;
  return (
    <div data-scope="profile" className="bg-background text-text-ivory flex min-h-dvh flex-col">
      <BackHeader title={t.settings.title} backHref={`${base}/profile`} profileHref={`${base}/profile`} t={t} />
      <main className="px-gutter bg-background relative mx-auto flex w-full max-w-md flex-1 flex-col pt-20 pb-24">
        <div className="gap-space-lg flex w-full flex-col">
          <section className="gap-space-sm flex flex-col">
            <div className="flex items-center gap-1.5 px-1">
              <Icon name="translate" className="text-primary text-[18px]" />
              <h2 className="font-headline-md text-headline-md text-text-ivory">{t.settings.language}</h2>
            </div>
            <div className="gap-space-xs flex flex-col" role="radiogroup" aria-label={t.settings.language}>
              {LOCALES.map((option) => {
                const selected = option === locale;
                const translated = t.settings.languageNames[option];
                return (
                  <Link
                    key={option}
                    href={switchLocalePath(path, option)}
                    replace
                    role="radio"
                    aria-checked={selected}
                    lang={option}
                    data-locale={option}
                    className="p-space-md bg-surface hover:bg-surface-container-high group flex items-center justify-between rounded-xl border border-[#6E5A3A]/20 shadow-md transition-all active:scale-[0.99]"
                  >
                    <div className="gap-space-md flex min-w-0 items-center">
                      <div
                        className={`font-label-md text-label-md flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg uppercase transition-colors ${
                          selected ? "bg-primary/20 text-primary" : "bg-surface-container-high text-text-muted group-hover:text-primary"
                        }`}
                      >
                        {option}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-label-md text-label-md text-text-ivory group-hover:text-primary truncate transition-colors">
                          {nativeNames[option]}
                        </span>
                        {translated !== nativeNames[option] ? (
                          <span lang={locale} className="font-caption text-caption text-text-muted truncate">
                            {translated}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="bg-surface-container-highest flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full">
                      <div className={`h-3 w-3 rounded-full ${selected ? "bg-primary shadow-[0_0_8px_#e4c285]" : "bg-transparent"}`}></div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="pt-space-xs text-caption text-text-muted flex items-center justify-center gap-1.5 text-center italic opacity-75">
              <Icon name="info" className="text-[13px]" />
              <span>{t.settings.languageNote}</span>
            </div>
          </section>

          <section className="gap-space-sm flex flex-col">
            <div className="flex items-center gap-1.5 px-1">
              <Icon name="settings" className="text-primary text-[18px]" />
              <h2 className="font-headline-md text-headline-md text-text-ivory">{t.settings.telegram}</h2>
            </div>
            <div className="p-space-md bg-surface flex items-center justify-between rounded-xl border border-[#6E5A3A]/20 shadow-md">
              <div className="gap-space-md flex min-w-0 items-center">
                <div className="bg-surface-container-high text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                  <Icon name="person" className="text-[22px]" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="font-label-md text-label-md text-text-ivory truncate">{t.settings.linkedAccount}</span>
                  <span className="font-caption text-caption text-text-muted truncate">
                    {telegram ? fill(t.settings.account, { username: telegram.username ?? "—", id: telegram.id }) : t.profile.notLinked}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <BottomNav base={base} active="profile" labels={t.nav} position="screen" />
    </div>
  );
}
