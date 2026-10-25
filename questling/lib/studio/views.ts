import { campaignById } from "@/lib/content/campaigns";
import { tr } from "@/lib/content/text";
import type { Facts } from "@/lib/game/facts";
import { activeDays, currentStreak, levelOf } from "@/lib/game/stats";
import { dayFromNumber, dayNumber, dayOf } from "@/lib/game/time";
import type { Locale } from "@/lib/i18n";
import type { Campaign } from "@/lib/story/graph";
import { isGraded } from "@/lib/story/graph";
import { chapterSolved, locate } from "@/lib/story/run";
import type { Assignment, Group, Member, StudioFacts } from "./model";

// What Teacher Studio's screens show, worked out from the teacher's facts: every count, percentage
// and list is computed here from what the students did. Pure functions, shared by the demo studio and
// the signed-in one. Nothing is shown that the records do not hold.

/** A member's record in the shape the student rules read, for streaks and levels. */
export function asFacts(member: Member): Facts {
  return {
    profile: {
      heroName: member.heroName,
      characterId: member.characterId,
      joinedAt: member.groups[0]?.joinedAt ?? new Date(0).toISOString(),
    },
    ledger: [{ currency: "xp", amount: member.xp, key: "total", reason: "demo", at: new Date(0).toISOString() }],
    answers: member.answers,
    completions: member.completions,
    saved: [],
    inventory: [],
    equipped: {},
    runs: member.runs,
  };
}

export const membersOf = (facts: StudioFacts, groupId: string | null) =>
  facts.members.filter((m) => !groupId || m.groups.some((g) => g.groupId === groupId));

export const activeGroups = (facts: StudioFacts) => facts.groups.filter((g) => !g.archivedAt);

/** A campaign by id: built-in, or one of the teacher's (the version given, else the latest published). */
export function campaignFor(facts: StudioFacts, id: string, version?: number | null): Campaign | null {
  const builtIn = campaignById.get(id);
  if (builtIn) return builtIn;
  const quest = facts.quests.find((q) => q.slug === id);
  const published = quest?.versions.filter((v) => v.status === "published") ?? [];
  return (version ? published.find((v) => v.version === version) : published.at(-1))?.graph ?? null;
}

export const assignmentsOf = (facts: StudioFacts, groupId: string) => facts.assignments.filter((a) => a.groupId === groupId);

export function campaignTitle(facts: StudioFacts, id: string, locale: Locale): string {
  const campaign = campaignFor(facts, id);
  if (campaign) return tr(campaign.title, locale);
  return facts.quests.find((q) => q.slug === id)?.title ?? id;
}

/** How far a student is in a campaign: graded scenes solved of all, 0–100; 100 once an ending is reached. */
export function progressIn(member: Member, campaign: Campaign): number {
  const run = member.runs.find((r) => r.campaign === campaign.id);
  if (!run) return 0;
  if (run.ending) return 100;
  const totals = campaign.chapters.map((c) => chapterSolved(c, run));
  const total = totals.reduce((n, t) => n + t.total, 0);
  return total ? Math.round((totals.reduce((n, t) => n + t.solved, 0) / total) * 100) : 0;
}

export type HelpRequest = { member: Member; ref: string; campaign: string; scene: string; at: string; answered: boolean };

/** Help requests of the students in a group (or all), newest first; answered once a reply was sent after it. */
export function helpRequests(facts: StudioFacts, groupId: string | null): HelpRequest[] {
  return membersOf(facts, groupId)
    .flatMap((member) =>
      member.completions
        .filter((c) => c.kind === "help_request")
        .map((c) => {
          const [campaign, scene] = c.ref.split("/");
          const answered = facts.messages.some((m) => m.userId === member.userId && m.ref === c.ref && m.createdAt >= c.at);
          return { member, ref: c.ref, campaign, scene, at: c.at, answered };
        }),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}

export const pendingHelp = (facts: StudioFacts, groupId: string | null) => helpRequests(facts, groupId).filter((h) => !h.answered);

export type StudentStatus = { kind: "done" | "help" | "progress" | "idle"; percent: number; chapter: string | null };

export function studentStatus(facts: StudioFacts, member: Member, group: Group, locale: Locale): StudentStatus {
  if (pendingHelp(facts, group.id).some((h) => h.member.userId === member.userId)) {
    const campaign = assignmentsOf(facts, group.id)
      .map((a) => campaignFor(facts, a.campaign, a.version))
      .find(Boolean);
    return { kind: "help", percent: campaign ? progressIn(member, campaign) : 0, chapter: null };
  }
  for (const a of assignmentsOf(facts, group.id)) {
    const campaign = campaignFor(facts, a.campaign, a.version);
    if (!campaign) continue;
    const run = member.runs.find((r) => r.campaign === campaign.id);
    if (!run) continue;
    const percent = progressIn(member, campaign);
    const chapter = locate(campaign, run.ending ?? run.scene)?.chapter;
    const lastDone = campaign.chapters.filter((c) => run.chapters.includes(c.id)).at(-1);
    if (run.ending) return { kind: "done", percent, chapter: lastDone ? tr(lastDone.label, locale) : null };
    return { kind: "progress", percent, chapter: chapter ? tr(chapter.label, locale) : null };
  }
  return { kind: "idle", percent: 0, chapter: null };
}

export function studentRow(facts: StudioFacts, member: Member, group: Group, locale: Locale, today: string) {
  const record = asFacts(member);
  const { level, into, next } = levelOf(member.xp);
  return { member, level, into, next, streak: currentStreak(record, today), status: studentStatus(facts, member, group, locale) };
}

/** A group's card: its members, its first assignment and how far the class is in it on average. */
export function groupCard(facts: StudioFacts, group: Group, locale: Locale) {
  const members = membersOf(facts, group.id);
  const first = assignmentsOf(facts, group.id)[0];
  const campaign = first ? campaignFor(facts, first.campaign, first.version) : null;
  const progress = campaign && members.length ? Math.round(members.reduce((n, m) => n + progressIn(m, campaign), 0) / members.length) : 0;
  // The chapter most of the class is in.
  const chapters = campaign
    ? members.map((m) => {
        const run = m.runs.find((r) => r.campaign === campaign.id);
        return run ? locate(campaign, run.ending ?? run.scene)?.chapter : campaign.chapters[0];
      })
    : [];
  const counts = new Map<string, number>();
  for (const c of chapters) if (c) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
  const common =
    campaign?.chapters.find((c) => c.id === [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]) ?? campaign?.chapters[0];
  return {
    group,
    members: members.length,
    campaign: campaign ? tr(campaign.title, locale) : null,
    chapter: common ? `${tr(common.title, locale)} (${tr(common.label, locale)})` : null,
    progress,
    pending: pendingHelp(facts, group.id).length,
  };
}

/** The dashboard's four figures. */
export function kpis(facts: StudioFacts, today: string) {
  const groups = activeGroups(facts);
  const members = facts.members.filter((m) => m.groups.some((g) => groups.some((x) => x.id === g.groupId)));
  const byLevel = new Map<string, number>();
  for (const g of groups) byLevel.set(g.cefr, (byLevel.get(g.cefr) ?? 0) + membersOf(facts, g.id).length);
  const assignments = facts.assignments.filter((a) => groups.some((g) => g.id === a.groupId));
  const builtIn = assignments.filter((a) => campaignById.has(a.campaign)).length;
  const completion = (() => {
    const values = assignments.flatMap((a) => {
      const campaign = campaignFor(facts, a.campaign, a.version);
      return campaign ? membersOf(facts, a.groupId).map((m) => progressIn(m, campaign)) : [];
    });
    return values.length ? Math.round(values.reduce((n, v) => n + v, 0) / values.length) : 0;
  })();
  // Active days in the last 7, on average per student; and in the 7 before, to compare.
  const daysActive = (from: number) => {
    const week = Array.from({ length: 7 }, (_, i) => dayFromNumber(dayNumber(today) - from - i));
    const counts = members.map((m) => week.filter((d) => activeDays(asFacts(m)).has(d)).length);
    return counts.length ? counts.reduce((n, v) => n + v, 0) / counts.length : 0;
  };
  const activity = daysActive(0);
  const before = daysActive(7);
  const streaks = members.map((m) => currentStreak(asFacts(m), today));
  return {
    groups: groups.length,
    students: members.length,
    levels: [...byLevel.entries()].sort(),
    assignments: assignments.length,
    builtIn,
    own: assignments.length - builtIn,
    completion,
    pending: pendingHelp(facts, null).length,
    activity: Math.round(activity * 10) / 10,
    /** Change on the week before, in percent; null when there is nothing to compare with. */
    activityDelta: before > 0 ? Math.round(((activity - before) / before) * 100) : null,
    bestStreak: streaks.length ? Math.max(...streaks) : 0,
  };
}

/** Tasks finished per day of the last seven (quests, story scenes, chapters), oldest first; `weeksBack` 1 for the week before. */
export function weekActivity(facts: StudioFacts, groupId: string | null, today: string, weeksBack = 0) {
  const members = membersOf(facts, groupId);
  return Array.from({ length: 7 }, (_, i) => {
    const day = dayFromNumber(dayNumber(today) - 7 * weeksBack - 6 + i);
    const count = members.reduce(
      (n, m) =>
        n +
        m.completions
          .filter((c) => c.kind === "quest" || c.kind === "story_node" || c.kind === "chapter")
          .filter((c) => dayOf(c.at) === day).length,
      0,
    );
    return { day, weekday: new Date(`${day}T12:00:00Z`).getUTCDay(), count };
  });
}

export type Topic = { id: string; title: string; sample: string; answers: number; errorRate: number };

/** The story scenes the class gets wrong most (and least): share of wrong answers, from at least two answers. */
export function topics(facts: StudioFacts, groupId: string | null, locale: Locale): Topic[] {
  const members = membersOf(facts, groupId);
  const stats = new Map<string, { wrong: number; all: number; campaign: string; scene: string }>();
  for (const m of members)
    for (const a of m.answers.filter((x) => x.scope === "story")) {
      const key = `${a.ref}/${a.question}`;
      const entry = stats.get(key) ?? { wrong: 0, all: 0, campaign: a.ref, scene: a.question };
      entry.all++;
      if (!a.correct) entry.wrong++;
      stats.set(key, entry);
    }
  const result: Topic[] = [];
  for (const [id, s] of stats) {
    if (s.all < 2) continue;
    const campaign = campaignFor(facts, s.campaign);
    const scene = campaign && locate(campaign, s.scene)?.scene;
    if (!scene || !isGraded(scene)) continue;
    const sample = scene.kind === "evidence" ? scene.question : scene.parchment;
    result.push({ id, title: tr(scene.grimoire.title, locale), sample, answers: s.all, errorRate: Math.round((s.wrong / s.all) * 100) });
  }
  return result.sort((a, b) => b.errorRate - a.errorRate || b.answers - a.answers);
}

/** Share of right answers per skill, for the group. */
export function skills(facts: StudioFacts, groupId: string | null) {
  const answers = membersOf(facts, groupId).flatMap((m) => m.answers);
  return (["vocabulary", "grammar", "reading", "listening", "cipher"] as const).map((skill) => {
    const mine = answers.filter((a) => a.skill === skill);
    return {
      skill,
      answers: mine.length,
      percent: mine.length ? Math.round((mine.filter((a) => a.correct).length / mine.length) * 100) : 0,
    };
  });
}

/** Per student, how many things they did on each of the last `days` days. */
export function heatmap(facts: StudioFacts, groupId: string | null, today: string, days = 10) {
  const dates = Array.from({ length: days }, (_, i) => dayFromNumber(dayNumber(today) - days + 1 + i));
  return {
    dates,
    rows: membersOf(facts, groupId).map((m) => ({
      member: m,
      counts: dates.map(
        (d) =>
          m.answers.filter((a) => dayOf(a.at) === d).length +
          m.completions.filter((c) => c.kind !== "achievement" && dayOf(c.at) === d).length,
      ),
    })),
  };
}

/** The gradebook: per student and assigned campaign, progress; and the CSV a teacher can download. */
export function gradebook(facts: StudioFacts, groupId: string, locale: Locale) {
  const assigned = assignmentsOf(facts, groupId)
    .map((a: Assignment) => ({ a, campaign: campaignFor(facts, a.campaign, a.version) }))
    .filter((x): x is { a: Assignment; campaign: Campaign } => !!x.campaign);
  const rows = membersOf(facts, groupId).map((m) => ({
    member: m,
    progress: assigned.map(({ campaign }) => progressIn(m, campaign)),
    answers: m.answers.length,
    correct: m.answers.filter((a) => a.correct).length,
  }));
  const header = ["Student", "Telegram", ...assigned.map(({ campaign }) => tr(campaign.title, locale)), "Answers", "Right"];
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    header,
    ...rows.map((r) => [
      r.member.heroName ?? "",
      r.member.username ? `@${r.member.username}` : "",
      ...r.progress.map((p) => `${p}%`),
      r.answers,
      r.correct,
    ]),
  ]
    .map((line) => line.map(cell).join(","))
    .join("\n");
  return { campaigns: assigned.map(({ campaign }) => campaign), rows, csv };
}

/** The group page's four figures. */
export function groupStats(facts: StudioFacts, group: Group, today: string, now: Date) {
  const members = membersOf(facts, group.id);
  const week = (back: number) => Array.from({ length: 7 }, (_, i) => dayFromNumber(dayNumber(today) - back - i));
  const thisWeek = new Set(week(0));
  const lastWeek = new Set(week(7));
  const active = members.filter((m) => [...thisWeek].some((d) => activeDays(asFacts(m)).has(d))).length;
  const rate = (days: Set<string> | null) => {
    const answers = members.flatMap((m) => m.answers).filter((a) => !days || days.has(dayOf(a.at)));
    return answers.length ? Math.round((answers.filter((a) => a.correct).length / answers.length) * 100) : null;
  };
  const score = rate(null) ?? 0;
  const recent = rate(thisWeek);
  const before = rate(lastWeek);
  const done = weekActivity(facts, group.id, today).reduce((n, d) => n + d.count, 0);
  const assignments = assignmentsOf(facts, group.id);
  const soon = assignments.filter(
    (a) => a.dueAt && Date.parse(a.dueAt) > now.getTime() && Date.parse(a.dueAt) - now.getTime() < 86_400_000,
  ).length;
  return {
    members: members.length,
    active,
    activeShare: members.length ? Math.round((active / members.length) * 100) : 0,
    score,
    scoreDelta: recent !== null && before !== null ? recent - before : null,
    done,
    perStudent: members.length ? Math.round((done / members.length) * 10) / 10 : 0,
    assignments: assignments.length,
    soon,
  };
}

/** How a group is doing in one assignment: who finished, the average progress, what it rewards. */
export function assignmentReport(facts: StudioFacts, assignment: Assignment) {
  const campaign = campaignFor(facts, assignment.campaign, assignment.version);
  const members = membersOf(facts, assignment.groupId);
  if (!campaign) return { campaign: null, finished: 0, total: members.length, progress: 0, xp: 0, behind: [] as Member[] };
  const progress = members.map((m) => ({ m, p: progressIn(m, campaign) }));
  const xp = campaign.chapters.reduce((n, c) => n + c.reward.xp + c.scenes.reduce((k, s) => k + (isGraded(s) ? s.xp : 0), 0), 0);
  return {
    campaign,
    finished: progress.filter((x) => x.p === 100).length,
    total: members.length,
    progress: progress.length ? Math.round(progress.reduce((n, x) => n + x.p, 0) / progress.length) : 0,
    xp,
    behind: progress.filter((x) => x.p < 100).map((x) => x.m),
  };
}

/** Campaigns a group could be given: the built-in ones and the teacher's published ones. */
export function assignable(facts: StudioFacts, locale: Locale) {
  const builtIn = [...campaignById.values()].map((c) => ({
    id: c.id,
    title: tr(c.title, locale),
    cefr: c.cefr,
    own: false,
    version: null as number | null,
  }));
  const own = facts.quests
    .filter((q) => !q.archivedAt)
    .flatMap((q) => {
      const latest = q.versions.filter((v) => v.status === "published").at(-1);
      return latest ? [{ id: q.slug, title: q.title, cefr: q.cefr as string, own: true, version: latest.version as number | null }] : [];
    });
  return [...builtIn, ...own];
}

export type LibraryEntry = {
  key: string;
  kind: "builtin" | "own";
  /** The quest's id for a teacher's campaign; the campaign id for a built-in one. */
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cefr: string;
  status: "published" | "draft" | "archived";
  published: number | null;
  draft: number | null;
  versions: number;
  campaign: Campaign;
  author: string | null;
  assignedTo: Group[];
  playing: number;
  progress: number;
};

/** Every campaign the studio offers: the built-in ones, then the teacher's own (by the latest version). */
export function library(facts: StudioFacts, locale: Locale): LibraryEntry[] {
  const groupsWith = (slug: string) => facts.groups.filter((g) => facts.assignments.some((a) => a.groupId === g.id && a.campaign === slug));
  const learners = (campaign: Campaign) => {
    const playing = facts.members.filter((m) => m.runs.some((r) => r.campaign === campaign.id));
    return {
      playing: playing.length,
      progress: playing.length ? Math.round(playing.reduce((n, m) => n + progressIn(m, campaign), 0) / playing.length) : 0,
    };
  };
  const builtIn: LibraryEntry[] = [...campaignById.values()].map((c) => ({
    key: c.id,
    kind: "builtin",
    id: c.id,
    slug: c.id,
    title: tr(c.title, locale),
    subtitle: locale === "ru" ? c.title.en : null,
    cefr: c.cefr,
    status: "published",
    published: c.version,
    draft: null,
    versions: 1,
    campaign: c,
    author: null,
    assignedTo: groupsWith(c.id),
    ...learners(c),
  }));
  const own: LibraryEntry[] = facts.quests.map((q) => {
    const published = q.versions.filter((v) => v.status === "published").at(-1) ?? null;
    const draft = q.versions.find((v) => v.status === "draft") ?? null;
    const latest = (draft ?? published ?? q.versions.at(-1))!;
    return {
      key: q.id,
      kind: "own",
      id: q.id,
      slug: q.slug,
      title: q.title,
      subtitle: null,
      cefr: q.cefr,
      status: q.archivedAt ? "archived" : published ? "published" : "draft",
      published: published?.version ?? null,
      draft: draft?.version ?? null,
      versions: q.versions.length,
      campaign: latest.graph,
      author: facts.teacher.displayName,
      assignedTo: groupsWith(q.slug),
      ...learners(published?.graph ?? latest.graph),
    };
  });
  return [...builtIn, ...own];
}

/** How many runs of the group's students are bound to each version of a teacher's campaign. */
export const runsOnVersion = (facts: StudioFacts, slug: string, version: number) =>
  facts.members.filter((m) => m.runs.some((r) => r.campaign === slug && r.version === version)).length;

/** Graded scenes by kind across the library's latest versions. */
export function sceneKinds(entries: LibraryEntry[]) {
  const counts = { question: 0, puzzle: 0, evidence: 0 };
  for (const e of entries)
    for (const c of e.campaign.chapters)
      for (const s of c.scenes) if (s.kind === "question" || s.kind === "puzzle" || s.kind === "evidence") counts[s.kind]++;
  return counts;
}
