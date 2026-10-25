"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { useStudent } from "@/lib/client/student";
import { worldOf } from "@/lib/game/world";
import { fill, LOCALES, switchLocalePath, type Locale } from "@/lib/i18n";
import { BackHeader } from "./back-header";
import { BottomNav } from "./bottom-nav";

// Settings, opened from the profile's "Настройки и Telegram ID" row. No Stitch screen exists for it,
// so it is built only from pieces of the approved ones (owner's rule: no new design): the
// story player's header, the profile's section headings, quick-access rows and demo note,
// and the story player's radio dot for the chosen language.

const nativeNames: Record<Locale, string> = { ru: "Русский", en: "English" };

/** The student's groups and mentors, joining one by its code, and the mentors' replies. */
function GroupSection() {
  const { t, locale, facts, account, join } = useStudent();
  const world = worldOf(facts);
  // The groups joined; the demo has none in its world, only the account's made-up group.
  const groups = world.groups.length ? world.groups : account.group ? [{ id: "account", cefr: null, ...account.group }] : [];
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [pending, start] = useTransition();
  const s = t.settings;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!join || code.trim().length < 8) return;
    start(async () => {
      const outcome = await join(code.trim());
      setResult(outcome === "ok" ? null : outcome === "not_found" ? s.notFound : outcome === "limited" ? s.limited : s.failed);
      if (outcome === "ok") {
        setCode("");
        setJoined(true);
      }
    });
  };
  return (
    <>
      <section className="gap-space-sm flex flex-col" data-settings-group>
        <div className="flex items-center gap-1.5 px-1">
          <Icon name="school" className="text-primary text-[18px]" />
          <h2 className="font-headline-md text-headline-md text-text-ivory">{s.group}</h2>
        </div>
        {groups.length === 0 ? <p className="font-body-md text-body-md text-text-muted px-1">{s.noGroup}</p> : null}
        {groups.map((g) => (
          <div
            key={g.id}
            className="p-space-md bg-surface flex items-center justify-between rounded-xl border border-[#6E5A3A]/20 shadow-md"
          >
            <div className="gap-space-md flex min-w-0 items-center">
              <div className="bg-secondary-container/50 text-secondary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                <Icon name="groups" className="text-[22px]" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="font-label-md text-label-md text-text-ivory truncate">{g.name}</span>
                <span className="font-caption text-caption text-text-muted truncate">{fill(s.mentor, { name: g.mentor })}</span>
              </div>
            </div>
            {g.cefr ? (
              <span className="bg-primary/15 text-primary font-caption text-caption rounded-full px-2 py-0.5">{g.cefr}</span>
            ) : null}
          </div>
        ))}
        <form onSubmit={submit} className="p-space-md bg-surface flex flex-col gap-2 rounded-xl border border-[#6E5A3A]/20 shadow-md">
          <label className="font-label-md text-label-md text-text-ivory" htmlFor="group-code">
            {s.code}
          </label>
          <div className="flex gap-2">
            <input
              id="group-code"
              value={code}
              onChange={(e) => (
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 8),
                ),
                setResult(null)
              )}
              disabled={!join}
              autoComplete="off"
              inputMode="text"
              placeholder="ABCD2345"
              className="bg-surface-container-lowest text-text-ivory font-label-md text-label-md focus:ring-primary min-w-0 flex-1 rounded-lg px-3 py-2 tracking-[0.2em] uppercase focus:ring-1 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!join || pending || code.length < 8}
              data-action="join-group"
              className="from-primary to-primary-container text-on-primary font-label-md text-label-md rounded-lg bg-gradient-to-b px-4 py-2 shadow-md disabled:opacity-50"
            >
              {s.join}
            </button>
          </div>
          {!join ? <p className="font-caption text-caption text-text-muted">{s.demoJoin}</p> : null}
          {result ? (
            <p role="alert" className="font-caption text-caption text-status-error">
              {result}
            </p>
          ) : joined && world.groups.length ? (
            <p role="status" className="font-caption text-caption text-status-success">
              {fill(s.joined, { name: world.groups.at(-1)!.name })}
            </p>
          ) : null}
        </form>
      </section>

      <section className="gap-space-sm flex flex-col" data-settings-replies>
        <div className="flex items-center gap-1.5 px-1">
          <Icon name="forum" className="text-primary text-[18px]" />
          <h2 className="font-headline-md text-headline-md text-text-ivory">{s.replies}</h2>
        </div>
        {world.messages.length === 0 ? <p className="font-body-md text-body-md text-text-muted px-1">{s.noReplies}</p> : null}
        {world.messages.map((m) => (
          <div key={m.id} className="p-space-md bg-surface flex flex-col gap-1 rounded-xl border border-[#6E5A3A]/20 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-md text-label-md text-primary truncate">{m.mentor}</span>
              <span className="font-caption text-caption text-text-muted shrink-0">
                {new Date(m.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}
              </span>
            </div>
            <p className="font-body-md text-body-md text-text-ivory">{m.body}</p>
          </div>
        ))}
      </section>
    </>
  );
}

/** Everything kept about the student: a file to keep, or all of it deleted (asked twice). */
function DataSection() {
  const { t, mode, downloadData, deleteData } = useStudent();
  const s = t.settings;
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  // A teacher's preview-as-student has no data of its own to hand over.
  if (!downloadData || !deleteData) return null;
  const download = () =>
    start(async () => {
      const outcome = await downloadData();
      setMessage(
        outcome === "ok" ? { text: s.downloadStarted, error: false } : { text: outcome === "limited" ? s.limited : s.failed, error: true },
      );
    });
  const remove = () =>
    start(async () => {
      const outcome = await deleteData();
      setConfirming(false);
      // The live app leaves this screen once the data is gone; the demo starts afresh and says nothing.
      if (outcome !== "ok") setMessage({ text: s.failed, error: true });
    });
  const button =
    "from-primary to-primary-container text-on-primary font-label-md text-label-md rounded-lg bg-gradient-to-b px-4 py-2 shadow-md disabled:opacity-50";
  return (
    <section className="gap-space-sm flex flex-col" data-settings-data>
      <div className="flex items-center gap-1.5 px-1">
        <Icon name="shield_person" className="text-primary text-[18px]" />
        <h2 className="font-headline-md text-headline-md text-text-ivory">{s.data}</h2>
      </div>
      <div className="p-space-md bg-surface flex flex-col gap-3 rounded-xl border border-[#6E5A3A]/20 shadow-md">
        <p className="font-body-md text-body-md text-text-muted">{mode === "demo" ? s.demoData : s.dataNote}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} disabled={pending} data-action="download-data" className={button}>
            <span className="flex items-center gap-1.5">
              <Icon name="download" className="text-[18px]" />
              {s.download}
            </span>
          </button>
          {!confirming ? (
            <button
              type="button"
              onClick={() => (setConfirming(true), setMessage(null))}
              disabled={pending}
              data-action="delete-data"
              className="bg-surface-container-high text-status-error font-label-md text-label-md rounded-lg px-4 py-2 shadow-md disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <Icon name="delete" className="text-[18px]" />
                {s.remove}
              </span>
            </button>
          ) : null}
        </div>
        {confirming ? (
          <div role="alertdialog" aria-label={s.remove} className="flex flex-col gap-2" data-confirm-delete>
            <p className="font-body-md text-body-md text-status-error">{s.removeConfirm}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                data-action="delete-data-confirm"
                className="bg-status-error text-text-ivory font-label-md text-label-md rounded-lg px-4 py-2 shadow-md disabled:opacity-50"
              >
                {s.removeYes}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="bg-surface-container-high text-text-ivory font-label-md text-label-md rounded-lg px-4 py-2 shadow-md"
              >
                {s.removeNo}
              </button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p
            role={message.error ? "alert" : "status"}
            className={`font-caption text-caption ${message.error ? "text-status-error" : "text-status-success"}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}

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

          <GroupSection />
          <DataSection />
        </div>
      </main>
      <BottomNav base={base} active="profile" labels={t.nav} position="screen" />
    </div>
  );
}
