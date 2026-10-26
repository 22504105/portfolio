"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { characters } from "@/lib/content/characters";
import { tr } from "@/lib/content/text";
import { useNow } from "@/lib/client/student";
import { useStudio } from "@/lib/client/studio";
import { dayOf } from "@/lib/game/time";
import { fill, plural } from "@/lib/i18n";
import { download, signed } from "@/lib/studio/format";
import { inviteLink } from "@/lib/studio/invite";
import { CEFR_LEVELS, type Cefr, type Group } from "@/lib/studio/model";
import type { StudioRefusal } from "@/lib/studio/ops";
import { assignable, assignmentReport, assignmentsOf, gradebook, groupStats, membersOf, pendingHelp, studentRow } from "@/lib/studio/views";
import { Avatar } from "./dashboard-screen";
import { StudioShell } from "./studio-shell";

// Ported from design-source/questling-v2/01_APPROVED_SCREENS/17_group_management/code.html.
// The group in view is the header's; everything is real: rename, level, archive, the roster (from
// the students who joined), the invite (a QR code of the group's own Telegram link, and the code to
// type in), assignments with their dates and progress. Left out, as the brief rules them out or they
// would be untrue: "+50 бонусных XP" (rewards come from learning only), the bot "reminder scroll"
// (not built; the batch action is the gradebook download), "ИИ-генератор" and "Webhook: Активен"
// (the card says which library campaigns fit the group's level instead).

type Dialog = { kind: "assign" } | { kind: "new" } | null;

export function GroupsScreen() {
  const { t, base, facts, groupId, setGroupId } = useStudio();
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow();
  const today = dayOf(now);
  const wanted = params.get("group");
  const [dialog, setDialog] = useState<Dialog>(params.get("new") ? { kind: "new" } : null);
  useEffect(() => {
    if (wanted && wanted !== groupId && facts.groups.some((g) => g.id === wanted)) setGroupId(wanted);
  }, [wanted, groupId, facts.groups, setGroupId]);
  const group = facts.groups.find((g) => g.id === (wanted && facts.groups.some((g) => g.id === wanted) ? wanted : groupId)) ?? null;

  return (
    <StudioShell section="groups" title={t.groups.title}>
      {group ? (
        <GroupPage key={group.id} group={group} openDialog={setDialog} today={today} now={now} />
      ) : (
        <div className="bg-surface p-space-xl gap-space-md flex flex-col items-start rounded-xl shadow-xl">
          <p className="font-body-md text-body-md text-text-muted">{t.dashboard.noGroups}</p>
          <button
            type="button"
            onClick={() => setDialog({ kind: "new" })}
            className="px-space-md bg-primary text-surface-container-lowest font-label-sm text-label-sm rounded-lg py-1.5"
            data-action="new-group"
          >
            {t.dashboard.createGroup}
          </button>
        </div>
      )}
      {dialog?.kind === "new" ? (
        <NewGroupDialog
          onClose={() => setDialog(null)}
          onCreated={(id) => {
            setGroupId(id);
            setDialog(null);
            router.replace(`${base}/groups?group=${id}`);
          }}
        />
      ) : null}
      {dialog?.kind === "assign" && group ? <AssignDialog group={group} onClose={() => setDialog(null)} /> : null}
    </StudioShell>
  );
}

function NewGroupDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t, act } = useStudio();
  const [name, setName] = useState("");
  const [cefr, setCefr] = useState<Cefr>("A2");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Modal title={t.groups.dialogNew} onClose={onClose}>
      <form
        className="gap-space-md flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await act({ type: "createGroup", name, cefr });
            if (result.ok && result.outcome.kind === "ok") onCreated(result.outcome.id!);
            else setError(true);
          });
        }}
      >
        <Field label={t.groups.name}>
          <input
            className={FIELD}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.groups.namePlaceholder}
            maxLength={60}
            required
            name="name"
          />
        </Field>
        <Field label={t.groups.cefr}>
          <select className={FIELD} value={cefr} onChange={(e) => setCefr(e.target.value as Cefr)} name="cefr">
            {CEFR_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t.groups.levels[level]}
              </option>
            ))}
          </select>
        </Field>
        {error ? (
          <p role="alert" className="font-caption text-caption text-status-error">
            {t.groups.errors.invalid}
          </p>
        ) : null}
        <GoldButton pending={pending} label={t.groups.create} icon="add_circle" />
      </form>
    </Modal>
  );
}

function AssignDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const { t, locale, facts, act } = useStudio();
  const refusalText = (refusal: StudioRefusal | "network" | "server" | "unauthenticated") =>
    (t.groups.errors as Record<string, string>)[refusal] ?? t.common.failed;
  const options = assignable(facts, locale);
  const [campaign, setCampaign] = useState(options[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal title={fill(t.groups.dialogAssign, { name: group.name })} onClose={onClose}>
      <form
        className="gap-space-md flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const chosen = options.find((o) => o.id === campaign);
            const result = await act({
              type: "assign",
              groupId: group.id,
              campaign,
              version: chosen?.version ?? null,
              dueAt: due ? new Date(due).toISOString() : null,
            });
            if (result.ok) onClose();
            else setError(refusalText(result.refusal));
          });
        }}
      >
        <Field label={t.groups.campaign}>
          <select className={FIELD} value={campaign} onChange={(e) => setCampaign(e.target.value)} name="campaign">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} • {o.cefr}
                {o.own ? ` • v${o.version}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.groups.dueDate}>
          <input className={FIELD} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} name="due" />
        </Field>
        {error ? (
          <p role="alert" className="font-caption text-caption text-status-error">
            {error}
          </p>
        ) : null}
        <GoldButton pending={pending} label={t.groups.assignButton} icon="auto_stories" />
      </form>
    </Modal>
  );
}

const FIELD =
  "bg-surface-container-lowest text-text-ivory placeholder-text-muted font-body-md text-body-md px-space-md py-space-sm focus:ring-primary-container w-full rounded-lg focus:ring-1 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-sm text-label-sm text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function GoldButton({ pending, label, icon }: { pending: boolean; label: string; icon: "add_circle" | "auto_stories" }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="gap-space-xs px-space-md py-space-sm text-surface-container-lowest font-label-md text-label-md flex items-center justify-center rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] shadow-[0_0_16px_rgba(185,154,97,0.25)] transition-all hover:brightness-110 disabled:opacity-60"
    >
      <Icon name={icon} className="text-[18px]" />
      <span>{label}</span>
    </button>
  );
}

/** A dialog in the studio's card style (the exports have none; built from the cards' parts). */
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className={`bg-surface p-space-md sm:p-space-lg gap-space-md flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-xl shadow-2xl ${wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-title-sm text-title-sm text-text-ivory">{title}</h2>
          <button type="button" onClick={onClose} aria-label="×" className="text-on-surface-variant hover:text-text-ivory rounded p-1">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GroupPage({ group, openDialog, today, now }: { group: Group; openDialog: (d: Dialog) => void; today: string; now: Date }) {
  const { t, locale, base, facts, act } = useStudio();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [notice, setNotice] = useState(true);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"name" | "level" | "streak">("name");
  const [copied, setCopied] = useState(false);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const stats = groupStats(facts, group, today, now);
  const members = membersOf(facts, group.id);
  const rows = members
    .map((m) => studentRow(facts, m, group, locale, today))
    .filter((r) => `${r.member.heroName ?? ""} ${r.member.username ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) =>
      sort === "level"
        ? b.member.xp - a.member.xp
        : sort === "streak"
          ? b.streak - a.streak
          : (a.member.heroName ?? "").localeCompare(b.member.heroName ?? "", locale),
    );
  const assignments = assignmentsOf(facts, group.id);
  const link = inviteLink(group.inviteCode);
  const fits = assignable(facts, locale).filter((c) => c.cefr.includes(group.cefr));
  const archived = !!group.archivedAt;

  const run = (action: Parameters<typeof act>[0], after?: () => void) =>
    start(async () => {
      setError(false);
      const result = await act(action);
      if (result.ok) after?.();
      else setError(true);
    });

  return (
    <div className="gap-space-lg flex w-full flex-col pb-12" data-group={group.id}>
      <div className="bg-surface p-space-lg relative overflow-hidden rounded-xl shadow-xl">
        <div className="bg-primary/5 pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl"></div>
        <div className="bg-secondary-container/20 pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full blur-3xl"></div>
        <div className="gap-space-md relative z-10 flex flex-col justify-between md:flex-row md:items-center">
          <div className="flex flex-col gap-1">
            <div className="gap-space-sm flex flex-wrap items-center">
              <span className="px-space-xs bg-primary-container/20 text-primary-fixed font-caption text-caption rounded py-0.5 font-semibold tracking-widest uppercase">
                {fill(t.groups.chip, { cefr: group.cefr })}
              </span>
              {renaming ? (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run({ type: "updateGroup", groupId: group.id, name }, () => setRenaming(false));
                  }}
                >
                  <input
                    autoFocus
                    className={`${FIELD} font-headline-md text-headline-md w-80`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    aria-label={t.groups.rename}
                  />
                  <button type="submit" className="text-primary p-1" aria-label={t.common.save} disabled={pending}>
                    <Icon name="check" className="text-[20px]" />
                  </button>
                </form>
              ) : (
                <h2 className="font-headline-lg text-headline-lg text-text-ivory gap-space-xs flex items-center tracking-wide">
                  {fill(t.groups.heading, { name: group.name })}
                  {!archived ? (
                    <button
                      type="button"
                      className="text-on-surface-variant hover:text-primary p-1 transition-colors"
                      title={t.groups.rename}
                      aria-label={t.groups.rename}
                      onClick={() => setRenaming(true)}
                    >
                      <Icon name="edit" className="text-[18px]" />
                    </button>
                  ) : null}
                </h2>
              )}
              <label className="px-space-sm bg-surface-container-high text-primary font-label-sm text-label-sm flex items-center gap-1.5 rounded-full py-1 shadow-sm">
                <Icon name="shield" className="text-[14px]" />
                <span className="sr-only">{t.groups.changeLevel}</span>
                <select
                  className="cursor-pointer bg-transparent focus:outline-none"
                  value={group.cefr}
                  disabled={archived || pending}
                  onChange={(e) => run({ type: "updateGroup", groupId: group.id, cefr: e.target.value as Cefr })}
                  data-level-select
                >
                  {CEFR_LEVELS.map((level) => (
                    <option key={level} value={level} className="bg-surface-container-high">
                      {fill(t.groups.level, { cefr: t.groups.levels[level] })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="font-body-md text-body-md text-text-muted">
              {fill(t.groups.meta, { students: plural(locale, members.length, t.common.students), mentor: facts.teacher.displayName })}
            </p>
            <label className="font-caption text-caption text-on-surface-variant flex items-start gap-2">
              <input
                type="checkbox"
                data-field="recommend"
                checked={group.recommend !== false}
                disabled={archived || pending}
                onChange={(e) => run({ type: "updateGroup", groupId: group.id, recommend: e.target.checked })}
              />
              <span>
                <span className="text-text-ivory font-label-sm text-label-sm block">{t.groups.recommend}</span>
                {t.groups.recommendNote}
              </span>
            </label>
          </div>
          <div className="gap-space-sm relative flex flex-wrap items-center">
            <a
              href="#invite"
              className="gap-space-xs px-space-md py-space-sm bg-surface-container-high text-text-ivory hover:bg-surface-bright font-label-md text-label-md flex items-center rounded-lg shadow-sm transition-all"
            >
              <Icon name="qr_code_2" className="text-primary text-[18px]" />
              <span>{t.groups.invite}</span>
            </a>
            <button
              type="button"
              onClick={() => openDialog({ kind: "assign" })}
              disabled={archived}
              data-action="assign"
              className="gap-space-xs px-space-md py-space-sm text-surface-container-lowest font-label-md text-label-md flex items-center rounded-lg bg-gradient-to-b from-[#D5B87E] to-[#B99A61] shadow-[0_0_16px_rgba(185,154,97,0.25)] transition-all hover:brightness-110 disabled:opacity-50"
            >
              <Icon name="auto_stories" className="text-[18px]" />
              <span>{t.groups.assign}</span>
            </button>
            <button
              type="button"
              aria-label={t.groups.settings}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
              className="p-space-sm bg-surface-container-high text-on-surface-variant hover:text-text-ivory hover:bg-surface-bright rounded-lg transition-all"
            >
              <Icon name="settings" className="text-[20px]" />
            </button>
            {menu ? (
              <div className="bg-surface-container-high absolute top-full right-0 z-30 mt-1 w-56 rounded-lg p-1 shadow-xl" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => (setMenu(false), openDialog({ kind: "new" }))}
                  className="font-label-md text-label-md text-text-ivory hover:bg-surface-bright flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
                >
                  <Icon name="add_circle" className="text-primary text-[18px]" /> {t.groups.newGroup}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => (setMenu(false), run({ type: "archiveGroup", groupId: group.id, archived: !archived }))}
                  className="font-label-md text-label-md text-text-ivory hover:bg-surface-bright flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
                >
                  <Icon name={archived ? "unarchive" : "archive"} className="text-[18px]" />{" "}
                  {archived ? t.groups.restore : t.groups.archive}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {archived ? (
          <div className="mt-space-md gap-space-sm p-space-md bg-error-container/20 text-status-error font-body-md text-body-md flex items-center rounded-lg">
            <Icon name="archive" className="text-[18px]" /> {t.groups.archived}
          </div>
        ) : notice ? (
          <div className="mt-space-md gap-space-sm p-space-md bg-surface-container-lowest text-text-ivory flex items-start rounded-lg shadow-inner">
            <div className="text-primary mt-0.5">
              <Icon name="info" className="text-[18px]" />
            </div>
            <div className="font-body-md text-body-md text-text-muted flex-1 leading-relaxed">
              <span className="text-primary font-medium">{t.groups.notice}</span> {t.groups.noticeText}
            </div>
            <button
              type="button"
              className="text-on-surface-variant hover:text-text-ivory p-1"
              aria-label={t.common.close}
              onClick={() => setNotice(false)}
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="font-caption text-caption text-status-error mt-2">
            {t.common.failed}
          </p>
        ) : null}
      </div>

      <div className="gap-space-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={t.groups.active}
          value={String(stats.active)}
          unit={fill(t.groups.activeOf, { n: stats.members })}
          icon="groups"
          iconTone="text-primary"
        >
          <span className="font-caption text-caption text-status-success mt-1 flex items-center gap-1">
            <span className="bg-status-success h-1.5 w-1.5 rounded-full"></span> {fill(t.groups.activeWeek, { n: stats.activeShare })}
          </span>
        </Metric>
        <Metric
          label={t.groups.score}
          value={String(stats.score)}
          unit={t.groups.scoreOf}
          icon="workspace_premium"
          iconTone="text-secondary"
          valueTone="text-primary"
        >
          {stats.scoreDelta !== null ? (
            <span
              className={`font-caption text-caption mt-1 flex items-center gap-1 ${stats.scoreDelta < 0 ? "text-status-error" : "text-status-success"}`}
            >
              <Icon name={stats.scoreDelta < 0 ? "trending_down" : "trending_up"} className="text-[12px]" />{" "}
              {fill(t.groups.scoreDelta, { delta: signed(stats.scoreDelta) })}
            </span>
          ) : null}
        </Metric>
        <Metric label={t.groups.done} value={String(stats.done)} unit={t.groups.doneUnit} icon="history_edu" iconTone="text-primary-fixed">
          <span className="font-caption text-caption text-text-muted mt-1">
            {fill(t.groups.donePer, { n: stats.perStudent.toLocaleString(locale) })}
          </span>
        </Metric>
        <Metric
          label={t.groups.current}
          value={String(stats.assignments)}
          unit={t.groups.currentUnit}
          icon="assignment_turned_in"
          iconTone="text-secondary-fixed"
          violet
        >
          <span
            className={`font-caption text-caption mt-1 flex items-center gap-1 ${stats.soon ? "text-status-error" : "text-text-muted"}`}
          >
            <Icon name="schedule" className="text-[12px]" />{" "}
            {stats.soon ? plural(locale, stats.soon, t.groups.deadlineSoon) : t.groups.noDeadline}
          </span>
        </Metric>
      </div>

      <div className="gap-space-lg grid grid-cols-1 items-start lg:grid-cols-12">
        <div className="gap-space-md flex flex-col lg:col-span-8">
          <div className="bg-surface flex flex-col overflow-hidden rounded-xl shadow-xl">
            <div className="p-space-md bg-surface-container-high/60 gap-space-md flex flex-wrap items-center justify-between">
              <div className="gap-space-sm flex items-center">
                <h3 className="font-title-sm text-title-sm text-text-ivory flex items-center gap-2">
                  <Icon name="cognition" className="text-primary text-[20px]" />
                  {t.groups.roster}
                </h3>
                <span className="bg-surface-container font-caption text-caption text-text-muted rounded-full px-2 py-0.5">
                  {plural(locale, members.length, t.common.students)}
                </span>
              </div>
              <div className="gap-space-sm flex items-center">
                <div className="relative flex items-center">
                  <Icon name="filter_list" className="text-on-surface-variant absolute left-2.5 text-[16px]" />
                  <input
                    className="bg-surface-container text-text-ivory placeholder-text-muted font-body-md text-body-md pr-space-md focus:ring-primary w-44 rounded-lg py-1 pl-8 focus:ring-1 focus:outline-none"
                    placeholder={t.groups.filter}
                    aria-label={t.groups.filter}
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                <label
                  className="bg-surface-container text-on-surface-variant hover:text-text-ivory flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors"
                  title={t.groups.sort}
                >
                  <Icon name="sort" className="text-[18px]" />
                  <select
                    className="font-caption text-caption cursor-pointer bg-transparent focus:outline-none"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    aria-label={t.groups.sort}
                  >
                    {(["name", "level", "streak"] as const).map((s) => (
                      <option key={s} value={s} className="bg-surface-container">
                        {t.groups.sorts[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low text-text-muted font-caption text-caption tracking-wider uppercase">
                    <th className="py-space-sm px-space-md">{t.groups.colStudent}</th>
                    <th className="py-space-sm px-space-sm">{t.groups.colHero}</th>
                    <th className="py-space-sm px-space-sm">{t.groups.colRank}</th>
                    <th className="py-space-sm px-space-sm">{t.groups.colStreak}</th>
                    <th className="py-space-sm px-space-sm">{t.groups.colStatus}</th>
                    <th className="py-space-sm px-space-md text-right">{t.groups.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-surface-container-high/30 font-body-md text-body-md divide-y">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-space-md px-space-md text-text-muted font-caption text-caption">
                        {t.groups.empty}
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((row) => {
                    const m = row.member;
                    const character = characters[m.characterId ?? "cat"];
                    const help = pendingHelp(facts, group.id).find((h) => h.member.userId === m.userId);
                    const status = row.status;
                    return (
                      <tr key={m.userId} className="hover:bg-surface-container/60 group transition-colors" data-member={m.userId}>
                        <td className="py-space-md px-space-md">
                          <div className="gap-space-sm flex min-w-0 items-center">
                            <Avatar characterId={m.characterId} size="h-10 w-10" />
                            <div className="flex min-w-0 flex-col">
                              <span className="font-label-md text-label-md text-text-ivory truncate font-medium">{m.heroName ?? "—"}</span>
                              <span className="font-caption text-caption text-secondary truncate">
                                {m.username ? `@${m.username}` : "—"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-space-md px-space-sm">
                          <span className="text-text-muted font-body-md text-body-md inline-flex items-center gap-1">
                            <Icon name="cruelty_free" className="text-primary text-[16px]" /> {tr(character.species, locale)}
                          </span>
                        </td>
                        <td className="py-space-md px-space-sm">
                          <div className="flex flex-col">
                            <span className="font-label-sm text-label-sm text-primary font-semibold">
                              {fill(t.groups.level7, { n: row.level })}
                            </span>
                            <div className="bg-surface-container-high mt-1 h-1.5 w-20 overflow-hidden rounded-full">
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${Math.round((row.into / row.next) * 100)}%` }}
                              ></div>
                            </div>
                            <span className="font-caption text-caption text-text-muted mt-0.5">
                              {row.into} / {row.next} XP
                            </span>
                          </div>
                        </td>
                        <td className="py-space-md px-space-sm">
                          <div
                            className={`font-label-sm text-label-sm flex items-center gap-1 ${row.streak > 2 ? "text-primary-fixed" : "text-text-muted"}`}
                          >
                            <Icon
                              name="local_fire_department"
                              className={`text-[16px] ${row.streak > 2 ? "text-primary" : "text-text-muted"}`}
                            />
                            <span>{fill(t.groups.streakDays, { n: row.streak })}</span>
                          </div>
                        </td>
                        <td className="py-space-md px-space-sm">
                          <StatusChip
                            kind={status.kind}
                            text={
                              status.kind === "done"
                                ? fill(t.groups.status.done, { chapter: status.chapter ?? "" })
                                : fill(t.groups.status[status.kind], { n: status.percent })
                            }
                          />
                        </td>
                        <td className="py-space-md px-space-md relative text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {help ? (
                              <Link
                                href={`${base}/analytics?help=${encodeURIComponent(`${m.userId}|${help.ref}`)}`}
                                className="px-space-sm bg-status-error/20 text-status-error hover:bg-status-error/30 font-label-sm text-label-sm rounded py-1 transition-all"
                              >
                                {t.groups.help}
                              </Link>
                            ) : (
                              <Link
                                href={`${base}/analytics?group=${group.id}&student=${m.userId}`}
                                className="px-space-sm bg-surface-container text-text-muted hover:text-text-ivory hover:bg-surface-container-high font-label-sm text-label-sm rounded py-1 transition-all"
                              >
                                {t.groups.report}
                              </Link>
                            )}
                            <button
                              type="button"
                              className="text-on-surface-variant hover:text-text-ivory hover:bg-surface-container rounded p-1"
                              title={t.groups.more}
                              aria-label={t.groups.more}
                              aria-expanded={rowMenu === m.userId}
                              onClick={() => setRowMenu(rowMenu === m.userId ? null : m.userId)}
                            >
                              <Icon name="more_vert" className="text-[18px]" />
                            </button>
                          </div>
                          {rowMenu === m.userId ? (
                            <div
                              className="bg-surface-container-high absolute top-full right-4 z-20 w-56 rounded-lg p-1 text-left shadow-xl"
                              role="menu"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="font-label-md text-label-md text-status-error hover:bg-surface-bright flex w-full items-center gap-2 rounded-md px-2 py-1.5"
                                onClick={() => {
                                  setRowMenu(null);
                                  if (window.confirm(fill(t.groups.removeConfirm, { name: m.heroName ?? m.username ?? "" })))
                                    run({ type: "removeMember", groupId: group.id, userId: m.userId });
                                }}
                              >
                                <Icon name="person_remove" className="text-[18px]" /> {t.groups.remove}
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-space-md bg-surface-container-low gap-space-sm flex flex-wrap items-center justify-between">
              <div className="gap-space-sm flex items-center">
                <span className="font-caption text-caption text-text-muted">{t.groups.batch}</span>
                <button
                  type="button"
                  onClick={() => download(`${group.name}.csv`, gradebook(facts, group.id, locale).csv)}
                  className="bg-surface-container text-text-ivory font-caption text-caption hover:bg-surface-container-high rounded px-2 py-1 transition-colors"
                >
                  {t.groups.exportCsv}
                </button>
              </div>
              <span className="font-caption text-caption text-text-muted">{fill(t.groups.attached, { n: members.length })}</span>
            </div>
          </div>
        </div>

        <div className="gap-space-lg flex flex-col lg:col-span-4">
          <div id="invite" className="bg-surface p-space-lg relative scroll-mt-20 overflow-hidden rounded-xl shadow-xl">
            <div className="mb-space-md flex items-center justify-between">
              <div className="gap-space-xs flex items-center">
                <div className="bg-surface-container-high text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                  <Icon name="send" className="text-[20px]" />
                </div>
                <h3 className="font-title-sm text-title-sm text-text-ivory">{t.groups.telegram}</h3>
              </div>
              <span className="font-caption text-caption text-status-success bg-status-success/15 flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
                <span className="bg-status-success h-1.5 w-1.5 rounded-full"></span> {fill(t.groups.joined, { n: members.length })}
              </span>
            </div>
            <p className="font-body-md text-body-md text-text-muted mb-space-md">{t.groups.telegramLead}</p>
            <div className="p-space-md bg-surface-container-lowest mb-space-md flex flex-col items-center justify-center rounded-lg shadow-inner">
              <div className="bg-text-ivory flex flex-col items-center rounded-lg p-3 shadow-[0_0_20px_rgba(228,194,133,0.15)]">
                <QrCode text={link} label={`${t.groups.code} ${group.inviteCode}`} />
              </div>
              <span className="font-caption text-caption text-text-muted mt-2 tracking-wide uppercase">
                {t.groups.code}{" "}
                <span className="text-primary font-mono font-medium" data-invite-code>
                  {group.inviteCode}
                </span>
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-caption text-caption text-text-muted" htmlFor="tg-invite-link">
                {t.groups.link}
              </label>
              <div className="gap-space-xs bg-surface-container-high flex items-center rounded-lg p-1.5">
                <Icon name="link" className="text-text-muted pl-1 text-[16px]" />
                <input
                  id="tg-invite-link"
                  className="text-text-ivory flex-1 bg-transparent font-mono text-[12px] outline-none select-all"
                  readOnly
                  type="text"
                  value={link.replace(/^https:\/\//, "")}
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}
                  className="px-space-sm bg-surface-container-highest text-primary hover:text-primary-fixed hover:bg-surface-bright font-label-sm text-label-sm flex items-center gap-1 rounded py-1 transition-all"
                >
                  <Icon name="content_copy" className="text-[14px]" />
                  <span>{t.groups.copy}</span>
                </button>
              </div>
              {copied ? <div className="text-status-success font-caption text-caption">{t.groups.copied}</div> : null}
              <div className="font-caption text-caption text-text-muted flex items-center justify-between gap-2 pt-1">
                <span>{t.groups.manual}</span>
                {!archived ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run({ type: "renewInvite", groupId: group.id })}
                    title={t.groups.renewNote}
                    className="text-primary shrink-0 hover:underline"
                  >
                    {t.groups.renew}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-surface p-space-lg gap-space-md flex flex-col rounded-xl shadow-xl">
            <div className="flex items-center justify-between">
              <div className="gap-space-xs flex items-center">
                <div className="bg-surface-container-high text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                  <Icon name="menu_book" className="text-[20px]" />
                </div>
                <h3 className="font-title-sm text-title-sm text-text-ivory">{t.groups.assigned}</h3>
              </div>
              <span className="bg-surface-container-high font-caption text-caption text-primary rounded-full px-2 py-0.5 font-medium">
                {plural(locale, assignments.length, t.groups.activeCount)}
              </span>
            </div>
            {assignments.length === 0 ? <p className="font-caption text-caption text-text-muted">{t.groups.noAssignments}</p> : null}
            {assignments.map((a, i) => {
              const report = assignmentReport(facts, a);
              const soon = a.dueAt && Date.parse(a.dueAt) - now.getTime() < 86_400_000;
              return (
                <div
                  key={a.id}
                  className="p-space-md bg-surface-container-high/60 gap-space-xs hover:bg-surface-container-high flex flex-col rounded-lg transition-all"
                  data-assignment={a.campaign}
                >
                  <div className="gap-space-xs flex items-start justify-between">
                    <div className="flex flex-col">
                      <span
                        className={`font-caption text-caption font-medium tracking-wider uppercase ${i % 2 ? "text-primary-fixed" : "text-secondary"}`}
                      >
                        {a.version ? fill(t.groups.ownKind, { v: a.version }) : t.groups.builtInKind}
                      </span>
                      <h4 className="font-label-md text-label-md text-text-ivory font-semibold">
                        {report.campaign ? tr(report.campaign.title, locale) : a.campaign}
                      </h4>
                    </div>
                    <span className="bg-primary-container/20 text-primary-fixed font-caption text-caption rounded px-2 py-0.5 whitespace-nowrap">
                      +{report.xp} XP
                    </span>
                  </div>
                  <div className="text-text-muted font-body-md text-body-md mt-1 flex items-center justify-between">
                    <span className={`font-caption text-caption flex items-center gap-1 ${soon ? "text-status-error font-medium" : ""}`}>
                      <Icon name={soon ? "alarm" : "event"} className="text-[14px]" />
                      {a.dueAt
                        ? fill(t.groups.due, {
                            date: new Date(a.dueAt).toLocaleString(locale, {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          })
                        : t.groups.noDue}
                    </span>
                    <span className="font-label-sm text-label-sm text-primary font-medium">
                      {fill(t.groups.finished, { n: report.finished, total: report.total })}
                    </span>
                  </div>
                  <div className="bg-surface-container mt-1 h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="from-primary to-primary-container h-full rounded-full bg-gradient-to-r transition-all duration-500"
                      style={{ width: `${report.progress}%` }}
                    ></div>
                  </div>
                  <div className="font-caption text-caption text-text-muted flex items-center justify-between pt-1">
                    <span>{report.behind.length ? plural(locale, report.behind.length, t.groups.onTheWay) : t.groups.allDone}</span>
                    <span className="flex items-center gap-2">
                      <Link className="text-primary flex items-center gap-0.5 hover:underline" href={`${base}/analytics?group=${group.id}`}>
                        <span>{t.groups.viewReport}</span>
                        <Icon name="chevron_right" className="text-[12px]" />
                      </Link>
                      {!archived ? (
                        <button
                          type="button"
                          className="text-on-surface-variant hover:text-status-error"
                          title={t.groups.unassign}
                          aria-label={t.groups.unassign}
                          onClick={() => run({ type: "unassign", assignmentId: a.id })}
                        >
                          <Icon name="close" className="text-[14px]" />
                        </button>
                      ) : null}
                    </span>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              disabled={archived}
              onClick={() => openDialog({ kind: "assign" })}
              className="py-space-sm px-space-md bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md gap-space-xs flex w-full items-center justify-center rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Icon name="add_circle" className="text-primary text-[18px]" />
              <span>{t.groups.assignNew}</span>
            </button>
          </div>

          <div className="bg-surface p-space-md gap-space-md flex items-center rounded-xl shadow-md">
            <div className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
              <Icon name="magic_button" className="text-[20px]" />
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-text-ivory font-medium">
                {fill(t.groups.hintTitle, { cefr: group.cefr })}
              </span>
              <p className="font-caption text-caption text-text-muted mt-0.5">
                {fits.length
                  ? fill(t.groups.hintText, { list: fits.map((c) => c.title).join(", ") })
                  : fill(t.groups.hintNone, { cefr: group.cefr })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type MetricIcon = "groups" | "workspace_premium" | "history_edu" | "assignment_turned_in";

function Metric(props: {
  label: string;
  value: string;
  unit: string;
  icon: MetricIcon;
  iconTone: string;
  valueTone?: string;
  violet?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface p-space-md flex items-center justify-between rounded-xl shadow-md">
      <div className="flex flex-col">
        <span className="font-caption text-caption text-text-muted tracking-wider uppercase">{props.label}</span>
        <div className="gap-space-xs mt-1 flex items-baseline">
          <span className={`font-headline-lg text-headline-lg font-semibold ${props.valueTone ?? "text-text-ivory"}`}>{props.value}</span>
          <span className="font-label-sm text-label-sm text-text-muted">{props.unit}</span>
        </div>
        {props.children}
      </div>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-lg ${props.violet ? "bg-secondary-container" : "bg-surface-container-high"} ${props.iconTone}`}
      >
        <Icon name={props.icon} className="text-[26px]" />
      </div>
    </div>
  );
}

type ChipIcon = "done_all" | "help_outline" | "timelapse" | "hourglass_empty";

function StatusChip({ kind, text }: { kind: "done" | "help" | "progress" | "idle"; text: string }) {
  const style: Record<typeof kind, { box: string; icon: ChipIcon }> = {
    done: { box: "bg-status-success/15 text-status-success font-semibold", icon: "done_all" },
    help: { box: "bg-status-error/15 text-status-error font-semibold", icon: "help_outline" },
    progress: { box: "bg-surface-container-high text-on-surface-variant", icon: "timelapse" },
    idle: { box: "bg-surface-container text-text-muted", icon: "hourglass_empty" },
  };
  return (
    <span
      className={`font-caption text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${style[kind].box}`}
      data-status={kind}
    >
      <Icon name={style[kind].icon} className="text-[12px]" /> {text}
    </span>
  );
}

/** The invite link as a QR code, drawn from the encoder's module matrix in the card's own colours. */
function QrCode({ text, label }: { text: string; label: string }) {
  const svg = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const cells: string[] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (qr.modules.get(x, y)) cells.push(`M${x + 2} ${y + 2}h1v1h-1z`);
    return { size: size + 4, path: cells.join("") };
  }, [text]);
  return (
    <svg
      className="text-surface-container-lowest h-36 w-36"
      viewBox={`0 0 ${svg.size} ${svg.size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      data-qr={text}
    >
      <path d={svg.path} fill="currentColor" />
    </svg>
  );
}
