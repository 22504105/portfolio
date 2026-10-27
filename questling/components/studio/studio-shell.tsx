"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useStudio } from "@/lib/client/studio";
import { fill, plural } from "@/lib/i18n";
import { activeGroups, membersOf, pendingHelp } from "@/lib/studio/views";

// Teacher Studio's frame, ported from the five approved teacher screens (16–20): the sidebar with
// the five sections, and the header with the breadcrumb, the group switch, search, the bell and the
// teacher's menu. Owner's decisions: the interface in Russian or English (the switch is in the
// teacher's menu here, as there is no settings screen in the teacher exports); honest status lines
// (the export's "Telegram: Синхронизировано" becomes how students join). On a phone (below lg) the
// same sidebar slides in over the page from the header's menu button, and the search folds into an icon.

export type StudioSection = "dashboard" | "groups" | "builder" | "library" | "dubbing" | "analytics";

const NAV: { id: StudioSection; icon: "dashboard" | "groups" | "auto_fix_high" | "auto_stories" | "rate_review" | "mic"; path: string }[] =
  [
    { id: "dashboard", icon: "dashboard", path: "" },
    { id: "groups", icon: "groups", path: "/groups" },
    { id: "builder", icon: "auto_fix_high", path: "/builder" },
    { id: "library", icon: "auto_stories", path: "/library" },
    { id: "dubbing", icon: "mic", path: "/dubbing" },
    { id: "analytics", icon: "rate_review", path: "/analytics" },
  ];

export function StudioShell({ section, title, children }: { section: StudioSection; title: string; children: React.ReactNode }) {
  const { t, base, facts, mode, groupId, studentBase } = useStudio();
  const pending = pendingHelp(facts, null).length;
  const group = facts.groups.find((g) => g.id === groupId);
  // The drawer remembers the address it was opened on: once the page changes under it (a tap on a
  // section), it is closed.
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const drawer = openedOn === pathname;
  const setDrawer = (open: boolean) => setOpenedOn(open ? pathname : null);
  useEffect(() => {
    if (!drawer) return;
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpenedOn(null);
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [drawer]);
  return (
    <div
      className="bg-background font-body-md text-on-surface selection:bg-secondary-container selection:text-secondary-fixed min-h-screen overflow-x-clip antialiased"
      data-studio-section={section}
    >
      {drawer ? (
        <button
          type="button"
          aria-label={t.shell.closeMenu}
          onClick={() => setDrawer(false)}
          className="fixed inset-0 z-50 bg-black/60 lg:hidden"
          data-drawer-backdrop
        />
      ) : null}
      <aside
        id="studio-nav"
        data-drawer={drawer ? "open" : "closed"}
        className={`bg-surface-container-lowest fixed top-0 left-0 z-[60] flex h-full w-72 max-w-[85vw] flex-col justify-between overflow-y-auto shadow-[0_1px_8px_rgba(0,0,0,0.4)] transition-transform duration-200 lg:z-50 lg:translate-x-0 ${drawer ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col">
          <div className="px-space-xl gap-space-md flex h-16 items-center">
            <div className="bg-surface-container text-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <Icon name="explore" className="text-[22px]" />
            </div>
            <div className="flex flex-col">
              <span className="font-title-sm text-title-sm text-primary tracking-wider uppercase">Questling</span>
              <span className="font-caption text-caption text-text-muted tracking-widest uppercase">{t.shell.studio}</span>
            </div>
          </div>
          <div className="px-space-md pt-space-md">
            <nav className="gap-space-xs flex flex-col" aria-label={t.shell.studio}>
              {NAV.map((item) => {
                const active = item.id === section;
                const badge = item.id === "analytics" && pending > 0 ? pending : null;
                return (
                  <Link
                    key={item.id}
                    href={`${base}${item.path}`}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "gap-space-md px-space-md py-space-sm bg-primary-container text-on-primary-container flex items-center justify-between rounded-lg font-semibold shadow-[0_0_16px_rgba(185,154,97,0.2)] transition-all duration-150"
                        : "gap-space-md px-space-md py-space-sm text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high hover:text-on-surface flex items-center justify-between rounded-lg transition-all duration-150"
                    }
                  >
                    <span className="gap-space-md flex items-center">
                      <Icon name={item.icon} className="text-[20px]" />
                      <span>{t.shell.nav[item.id]}</span>
                    </span>
                    {badge ? (
                      <span className="px-space-xs bg-secondary-container text-on-secondary-container font-caption text-caption rounded-full py-0.5">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
        <div className="p-space-md gap-space-sm bg-surface-container-lowest flex flex-col">
          <div className="gap-space-xs px-space-sm bg-surface-container-low flex items-center rounded-lg py-1">
            <span className={`h-2 w-2 rounded-full ${mode === "demo" ? "bg-secondary" : "bg-status-success"}`}></span>
            <span className="font-caption text-caption text-text-muted">{mode === "demo" ? t.shell.telegramDemo : t.shell.telegram}</span>
          </div>
          <div className="p-space-sm bg-surface-container flex items-center justify-between rounded-lg">
            <div className="gap-space-sm flex min-w-0 items-center">
              <div className="bg-secondary-container flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Icon name="school" className="text-secondary text-[18px]" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="font-label-md text-label-md text-text-ivory truncate leading-tight">{facts.teacher.displayName}</span>
                <span className="font-caption text-caption text-text-muted">
                  {group ? fill(t.shell.mentor, { cefr: group.cefr }) : t.shell.mentorNoGroup}
                </span>
              </div>
            </div>
            <Link
              href={`${base}/library`}
              className="text-on-surface-variant hover:text-primary transition-colors"
              title={t.shell.library}
              aria-label={t.shell.library}
            >
              <Icon name="menu_book" className="text-[18px]" />
            </Link>
          </div>
          <Link
            href={`${studentBase}/home`}
            className="gap-space-xs py-space-sm px-space-md bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-sm text-label-sm flex items-center justify-center rounded-lg transition-all"
          >
            <Icon name="visibility" className="text-[16px]" />
            <span>{t.shell.studentView}</span>
          </Link>
        </div>
      </aside>
      <div className="lg:pl-72">
        <StudioHeader title={title} onMenu={() => setDrawer(true)} drawer={drawer} />
        <main className="bg-background px-space-md lg:px-space-xl py-space-lg relative min-h-screen w-full min-w-0 pt-16">{children}</main>
      </div>
    </div>
  );
}

function StudioHeader({ title, onMenu, drawer }: { title: string; onMenu: () => void; drawer: boolean }) {
  const { t, locale, facts, base, groupId, setGroupId, signOut } = useStudio();
  const [open, setOpen] = useState<"groups" | "search" | "menu" | null>(null);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const pending = pendingHelp(facts, null).length;
  const groups = activeGroups(facts);
  const group = facts.groups.find((g) => g.id === groupId);

  useEffect(() => {
    const close = (event: MouseEvent) => !root.current?.contains(event.target as Node) && setOpen(null);
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const students = facts.members
      .filter((m) => `${m.heroName ?? ""} ${m.username ?? ""}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((m) => ({ id: m.userId, label: m.heroName ?? m.username ?? "—", href: `${base}/groups?group=${m.groups[0]?.groupId ?? ""}` }));
    const quests = facts.quests
      .filter((x) => x.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((x) => ({ id: x.id, label: x.title, href: `${base}/builder?quest=${x.id}` }));
    return { students, quests };
  }, [query, facts, base]);

  const other = locale === "ru" ? "en" : "ru";
  const switchTo = pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${other}`);

  return (
    <header
      ref={root}
      className="bg-surface/90 px-space-md lg:px-space-xl gap-space-sm fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.3)] backdrop-blur-xl lg:left-72"
    >
      <div className="gap-space-sm lg:gap-space-lg flex min-w-0 items-center">
        <button
          type="button"
          onClick={onMenu}
          aria-label={t.shell.openMenu}
          aria-expanded={drawer}
          aria-controls="studio-nav"
          className="text-on-surface-variant hover:bg-surface-container -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg lg:hidden"
          data-action="open-menu"
        >
          <Icon name="menu" className="text-[22px]" />
        </button>
        <div className="gap-space-xs font-body-md text-body-md text-text-muted flex min-w-0 items-center whitespace-nowrap">
          <Link href={base} className="hover:text-text-ivory hidden transition-colors md:inline">
            {t.shell.academy}
          </Link>
          <span className="hidden md:inline">/</span>
          <h1 className="text-text-ivory truncate font-medium">{title}</h1>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-expanded={open === "groups"}
            aria-haspopup="listbox"
            onClick={() => setOpen(open === "groups" ? null : "groups")}
            aria-label={
              group
                ? fill(t.shell.groupLabel, {
                    name: group.name,
                    students: plural(locale, membersOf(facts, group.id).length, t.common.students),
                  })
                : t.shell.noGroup
            }
            className="gap-space-xs px-space-sm md:px-space-md py-space-xs bg-surface-container text-text-ivory hover:bg-surface-container-high flex items-center rounded-lg transition-colors"
            data-group-switch
          >
            <Icon name="shield_person" className="text-primary text-[18px]" />
            <span className="font-label-md text-label-md hidden max-w-[260px] truncate sm:inline">
              {group
                ? fill(t.shell.groupLabel, {
                    name: group.name,
                    students: plural(locale, membersOf(facts, group.id).length, t.common.students),
                  })
                : t.shell.noGroup}
            </span>
            <Icon name="expand_more" className="text-on-surface-variant text-[16px]" />
          </button>
          {open === "groups" && groups.length ? (
            <ul
              role="listbox"
              className="bg-surface-container-high absolute top-full left-0 z-50 mt-1 max-w-[calc(100vw-2rem)] min-w-full rounded-lg p-1 shadow-xl sm:max-w-none"
            >
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={g.id === groupId}
                    onClick={() => {
                      setGroupId(g.id);
                      setOpen(null);
                    }}
                    className={`font-label-md text-label-md px-space-md py-space-sm w-full rounded-md text-left transition-colors sm:whitespace-nowrap ${g.id === groupId ? "text-primary bg-surface-container" : "text-text-ivory hover:bg-surface-bright"}`}
                  >
                    {fill(t.shell.groupLabel, { name: g.name, students: plural(locale, membersOf(facts, g.id).length, t.common.students) })}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="gap-space-xs md:gap-space-lg flex shrink-0 items-center">
        <button
          type="button"
          aria-label={t.shell.search}
          aria-expanded={open === "search"}
          onClick={() => setOpen(open === "search" ? null : "search")}
          className="text-on-surface-variant hover:bg-surface-container flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
          data-action="open-search"
        >
          <Icon name="search" className="text-[20px]" />
        </button>
        <div
          className={`items-center md:relative md:flex ${open === "search" ? "max-md:bg-surface max-md:px-space-md max-md:py-space-sm flex max-md:absolute max-md:inset-x-0 max-md:top-full max-md:shadow-lg" : "hidden"}`}
        >
          <Icon name="search" className="text-on-surface-variant absolute left-3 text-[18px] max-md:left-7" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen("search");
            }}
            onFocus={() => setOpen("search")}
            aria-label={t.shell.search}
            className="bg-surface-container-lowest text-text-ivory placeholder-text-muted font-body-md text-body-md pr-space-md py-space-xs focus:ring-primary-container w-full rounded-lg pl-9 focus:ring-1 focus:outline-none md:w-72"
            placeholder={t.shell.search}
          />
          {open === "search" && results ? (
            <div
              className="bg-surface-container-high max-md:left-space-md max-md:right-space-md absolute top-full right-0 z-50 mt-1 w-72 rounded-lg p-2 shadow-xl max-md:w-auto"
              role="listbox"
            >
              {results.students.length + results.quests.length === 0 ? (
                <p className="font-caption text-caption text-text-muted p-2">{t.shell.searchEmpty}</p>
              ) : null}
              {(
                [
                  [t.shell.searchStudents, results.students],
                  [t.shell.searchQuests, results.quests],
                ] as const
              ).map(([label, list]) =>
                list.length ? (
                  <div key={label} className="mb-1">
                    <span className="font-caption text-caption text-text-muted px-2 uppercase">{label}</span>
                    {list.map((r) => (
                      <Link
                        key={r.id}
                        href={r.href}
                        onClick={() => setOpen(null)}
                        className="font-label-md text-label-md text-text-ivory hover:bg-surface-bright block rounded-md px-2 py-1.5"
                      >
                        {r.label}
                      </Link>
                    ))}
                  </div>
                ) : null,
              )}
            </div>
          ) : null}
        </div>
        <Link
          href={`${base}/analytics`}
          aria-label={`${t.shell.notifications}: ${pending}`}
          className="p-space-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container relative rounded-lg transition-all"
        >
          <Icon name="notifications" className="text-[20px]" />
          {pending ? <span className="bg-status-error absolute top-1 right-1 h-2 w-2 rounded-full"></span> : null}
        </Link>
        <div className="relative">
          <button
            type="button"
            aria-label={t.shell.menu}
            aria-expanded={open === "menu"}
            onClick={() => setOpen(open === "menu" ? null : "menu")}
            className="bg-primary flex h-8 w-8 items-center justify-center rounded-full"
          >
            <Icon name="person" className="text-on-primary text-[18px]" />
          </button>
          {open === "menu" ? (
            <div className="bg-surface-container-high absolute top-full right-0 z-50 mt-2 w-60 rounded-lg p-2 shadow-xl" role="menu">
              <p className="font-label-md text-label-md text-text-ivory truncate px-2 pt-1">{facts.teacher.displayName}</p>
              <p className="font-caption text-caption text-text-muted truncate px-2 pb-2">{facts.teacher.email}</p>
              <span className="font-caption text-caption text-text-muted px-2 uppercase">{t.shell.language}</span>
              <div className="flex gap-1 px-2 py-1.5">
                {(["ru", "en"] as const).map((l) => (
                  <Link
                    key={l}
                    href={l === locale ? pathname : switchTo}
                    role="menuitemradio"
                    aria-checked={l === locale}
                    className={`font-label-sm text-label-sm flex-1 rounded-md py-1 text-center uppercase ${l === locale ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-text-ivory hover:bg-surface-bright"}`}
                  >
                    {l}
                  </Link>
                ))}
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                className="font-label-md text-label-md text-text-ivory hover:bg-surface-bright mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
              >
                <Icon name="logout" className="text-[18px]" />
                {t.shell.signOut}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
