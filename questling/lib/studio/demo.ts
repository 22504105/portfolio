import { campaignById } from "@/lib/content/campaigns";
import { keysOf } from "@/lib/content/campaigns/keys";
import type { CharacterId } from "@/lib/content/characters";
import { dailyQuizKeys } from "@/lib/content/daily-keys";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import { applyEffects, emptyFacts, type Facts } from "@/lib/game/facts";
import { run, type Action } from "@/lib/game/ops";
import { balance, dailyEntry, dailyQuests, runOf } from "@/lib/game/stats";
import { dayFromNumber, dayNumber, dayOf } from "@/lib/game/time";
import type { Answer, QuestionKey } from "@/lib/learning/questions";
import { rightMove } from "@/lib/story/autoplay";
import { locate, startRun } from "@/lib/story/run";
import type { Member, StudioFacts } from "./model";
import { starterCampaign } from "./starter";

// The demo studio's made-up classes. Like the demo student (lib/demo/seed.ts), every student here
// played through the real rules: daily quests, the day's word, the story, with wrong answers and
// help requests where a student is weaker. So every figure the demo studio shows — progress, errors,
// streaks, the review queue — is worked out from records, not drawn. The screens say "Демо".

/** A small seeded random source, so the demo classes are the same on every visit. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

const answerFor = (key: QuestionKey): Answer => {
  switch (key.kind) {
    case "choice":
      return { kind: "choice", option: key.correct };
    case "multi":
      return { kind: "multi", options: key.correct };
    case "fill":
      return { kind: "fill", word: key.correct };
    case "order":
      return { kind: "order", tiles: key.correct };
    case "match":
      return { kind: "match", pairs: key.correct };
  }
};

type Profile = {
  id: string;
  hero: string;
  username: string;
  character: CharacterId;
  /** How often a first answer is right, 0–1. */
  skill: number;
  /** Days played of the last ten. */
  days: number;
  campaign: string;
  /** How far into the campaign: the scene to stop before (or the end). */
  until: string | null;
  choices?: Record<string, string>;
  /** Stops at a scene with no attempts left and asks the mentor for help. */
  stuck?: boolean;
};

/** Noon (Moscow) of a day `offset` days from today's; for today, never later than three hours ago. */
const noonOf = (now: Date, offset: number) => {
  const noon = new Date(`${dayFromNumber(dayNumber(dayOf(now)) + offset)}T09:00:00Z`);
  return offset === 0 && noon.getTime() > now.getTime() - 3 * 3_600_000 ? new Date(now.getTime() - 3 * 3_600_000) : noon;
};

function simulate(profile: Profile, now: Date, seed: number): Facts {
  const random = seeded(seed);
  // Their group was assigned this campaign: it is open for them as for a real student in the group.
  let facts: Facts = {
    ...emptyFacts(noonOf(now, -20).toISOString()),
    world: {
      groups: [],
      assignments: [{ groupId: "demo", campaign: profile.campaign, version: null, dueAt: null }],
      campaigns: [],
      messages: [],
    },
  };
  const act = (action: Action, at: Date) => {
    const result = run(facts, action, { now: at, locale: "ru", demo: true, random });
    if (result.ok) facts = applyEffects(facts, result.effects, at.toISOString());
    return result;
  };
  act({ type: "chooseCharacter", characterId: profile.character }, noonOf(now, -20));
  act({ type: "renameHero", name: profile.hero }, noonOf(now, -20));

  // The days played: the last `days` of ten, with a gap now and then for the weaker ones.
  const played = Array.from({ length: 10 }, (_, i) => i - 9).filter(() => random() < profile.days / 10);
  const campaign = campaignById.get(profile.campaign)!;
  const keys = keysOf(campaign);
  const storyDays = new Set(played.filter((_, i) => i % 2 === 0));

  for (const offset of played) {
    const at = noonOf(now, offset);
    const day = dayOf(at);
    const quest = dailyQuests(day)[Math.floor(random() * 2)];
    for (const [questionId, key] of Object.entries(quickQuestKeys[quest.id])) {
      // A weaker student first tries a wrong option of the question.
      const question = quest.questions.find((q) => q.id === questionId);
      const wrong = question?.kind === "choice" && key.kind === "choice" ? question.options.find((o) => o.id !== key.correct) : undefined;
      if (wrong && random() > profile.skill)
        act({ type: "answerQuest", questId: quest.id, questionId, answer: { kind: "choice", option: wrong.id } }, at);
      act({ type: "answerQuest", questId: quest.id, questionId, answer: answerFor(key) }, at);
    }
    const daily = dailyQuizKeys[dailyEntry(day).id];
    if (random() < profile.skill) act({ type: "answerDailyQuiz", option: daily.correct }, at);
    act({ type: "claimDaily" }, at);

    if (!storyDays.has(offset)) continue;
    // Some story on this day: a few scenes, with a wrong answer first when the student is unsure.
    for (let step = 0; step < 6; step++) {
      const current = runOf(facts, campaign.id) ?? startRun(campaign);
      if (current.ending || current.scene === profile.until) break;
      const scene = locate(campaign, current.scene)?.scene;
      if (scene && (scene.kind === "question" || scene.kind === "evidence") && random() > profile.skill) {
        const key = keys[scene.id];
        const wrong =
          scene.kind === "question"
            ? scene.options.find((o) => key?.kind === "question" && o.id !== key.correct)?.id
            : scene.clues.find((c) => key?.kind === "evidence" && !key.correct.includes(c) && current.clues.includes(c));
        if (wrong) act({ type: "story", campaign: campaign.id, move: { type: "answer", scene: scene.id, answer: wrong } }, at);
      }
      const move = rightMove(campaign, keys, runOf(facts, campaign.id) ?? current, profile.choices);
      if (!move) break;
      act({ type: "story", campaign: campaign.id, move }, at);
    }
  }

  // The stuck one: at their scene, every attempt used, and a request to the mentor.
  if (profile.stuck) {
    // Some hours ago, so the request is always in the past whatever the time of day.
    const at = new Date(now.getTime() - (1 + (seed % 5)) * 47 * 60_000);
    const current = runOf(facts, campaign.id);
    const scene = current && locate(campaign, current.scene)?.scene;
    if (scene && scene.kind === "question") {
      const key = keys[scene.id];
      for (const option of scene.options)
        if (key?.kind === "question" && option.id !== key.correct)
          act({ type: "story", campaign: campaign.id, move: { type: "answer", scene: scene.id, answer: option.id } }, at);
      act({ type: "askMentor", campaign: campaign.id, scene: scene.id }, at);
    }
  }
  return facts;
}

const GROUPS = [
  {
    id: "a2a2a2a2-0000-4000-8000-000000000001",
    name: "Детективы A2",
    cefr: "A2" as const,
    inviteCode: "DETA2KVN",
    campaign: "forgotten-academy",
  },
  {
    id: "a1a1a1a1-0000-4000-8000-000000000002",
    name: "Новички A1",
    cefr: "A1" as const,
    inviteCode: "NOVA1QRS",
    campaign: "forgotten-academy",
  },
  { id: "b1b1b1b1-0000-4000-8000-000000000003", name: "Искатели B1", cefr: "B1" as const, inviteCode: "ISKB1TXZ", campaign: "echo-tower" },
];

const PEOPLE: (Profile & { group: number })[] = [
  {
    group: 0,
    id: "1",
    hero: "Барсик",
    username: "barsik_magic",
    character: "cat",
    skill: 0.85,
    days: 9,
    campaign: "forgotten-academy",
    until: "tower-2",
    stuck: true,
  },
  {
    group: 0,
    id: "2",
    hero: "Алиса",
    username: "alice_wind",
    character: "girl",
    skill: 0.95,
    days: 10,
    campaign: "forgotten-academy",
    until: "f-path",
  },
  {
    group: 0,
    id: "3",
    hero: "Даниил",
    username: "dan_fox",
    character: "fox",
    skill: 0.7,
    days: 6,
    campaign: "forgotten-academy",
    until: "tower-4",
  },
  {
    group: 0,
    id: "4",
    hero: "София",
    username: "sofia_owl",
    character: "owl",
    skill: 0.9,
    days: 8,
    campaign: "forgotten-academy",
    until: "f-path",
  },
  {
    group: 0,
    id: "5",
    hero: "Марк",
    username: "mark_shade",
    character: "forest",
    skill: 0.45,
    days: 4,
    campaign: "forgotten-academy",
    until: "tower-1",
    stuck: true,
  },
  {
    group: 0,
    id: "6",
    hero: "Елена",
    username: "helena_runes",
    character: "girl",
    skill: 0.8,
    days: 7,
    campaign: "forgotten-academy",
    until: "tower-5",
  },
  {
    group: 0,
    id: "7",
    hero: "Тимофей",
    username: "tima_spell",
    character: "boy",
    skill: 0.65,
    days: 5,
    campaign: "forgotten-academy",
    until: "tower-3",
  },
  {
    group: 1,
    id: "8",
    hero: "Михаил",
    username: "misha_lamp",
    character: "boy",
    skill: 0.6,
    days: 6,
    campaign: "forgotten-academy",
    until: "prologue-1",
    stuck: true,
  },
  {
    group: 1,
    id: "9",
    hero: "Вера",
    username: "vera_moon",
    character: "cat",
    skill: 0.85,
    days: 8,
    campaign: "forgotten-academy",
    until: "tower-2",
  },
  {
    group: 1,
    id: "10",
    hero: "Илья",
    username: "ilya_spark",
    character: "fox",
    skill: 0.75,
    days: 5,
    campaign: "forgotten-academy",
    until: "t-intro",
  },
  {
    group: 2,
    id: "11",
    hero: "Ева",
    username: "eva_echo",
    character: "owl",
    skill: 0.8,
    days: 7,
    campaign: "echo-tower",
    until: "e-tense",
    stuck: false,
  },
  {
    group: 2,
    id: "12",
    hero: "Арсений",
    username: "arseny_k",
    character: "forest",
    skill: 0.55,
    days: 5,
    campaign: "echo-tower",
    until: "e-wind",
    stuck: true,
  },
  {
    group: 2,
    id: "13",
    hero: "Диана",
    username: "diana_trail",
    character: "girl",
    skill: 0.9,
    days: 9,
    campaign: "echo-tower",
    until: "a-cond",
    choices: { "e-choice": "press" },
  },
];

export const DEMO_TEACHER = {
  userId: "eeeeeeee-0000-4000-8000-000000000001",
  displayName: "Архимаг Элеонора",
  email: "demo@questling.example",
};

export function demoStudio(now: Date): StudioFacts {
  const members: Member[] = PEOPLE.map((person, i) => {
    const facts = simulate(person, now, 7919 * (i + 1));
    return {
      userId: `dddddddd-0000-4000-8000-${person.id.padStart(12, "0")}`,
      heroName: facts.profile.heroName,
      characterId: facts.profile.characterId,
      username: person.username,
      groups: [{ groupId: GROUPS[person.group].id, joinedAt: noonOf(now, -20).toISOString() }],
      xp: balance(facts, "xp"),
      answers: facts.answers,
      completions: facts.completions,
      runs: facts.runs,
    };
  });
  const created = noonOf(now, -30).toISOString();
  const own = starterCampaign("t-tajna-chasov-demo01", "Тайна часовой башни", "A2");
  const published = { ...own.graph, version: 1 };
  return {
    teacher: DEMO_TEACHER,
    groups: GROUPS.map((g) => ({ id: g.id, name: g.name, cefr: g.cefr, inviteCode: g.inviteCode, createdAt: created, archivedAt: null })),
    members,
    quests: [
      {
        id: "99999999-0000-4000-8000-000000000001",
        slug: "t-tajna-chasov-demo01",
        title: "Тайна часовой башни",
        cefr: "A2",
        createdAt: created,
        archivedAt: null,
        versions: [
          {
            version: 1,
            status: "published",
            graph: published,
            keys: own.keys,
            note: "Первая версия",
            updatedAt: created,
            publishedAt: created,
          },
          {
            version: 2,
            status: "draft",
            graph: { ...own.graph, version: 2 },
            keys: own.keys,
            note: null,
            updatedAt: noonOf(now, -1).toISOString(),
            publishedAt: null,
          },
        ],
      },
    ],
    assignments: GROUPS.map((g, i) => ({
      id: `cccccccc-0000-4000-8000-00000000000${i + 1}`,
      groupId: g.id,
      campaign: g.campaign,
      version: null,
      startsAt: created,
      dueAt: noonOf(now, 7 + i).toISOString(),
    })),
    daily: [],
    messages: [],
  };
}
