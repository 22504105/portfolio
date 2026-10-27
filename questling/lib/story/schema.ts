import { z } from "zod";
import { OBJECTIVE_IDS, type Objective } from "@/lib/learning/objectives";
import type { Campaign, CampaignKeys } from "./graph";

// The shape of a teacher-authored campaign and its keys, checked on the way in (Teacher Studio's
// builder sends them as JSON). Text is plain text: nothing is ever rendered as HTML. Pictures can
// only be the app's own illustrations, never an address from outside. Graph soundness (targets,
// reachability, endings, evidence) is checked after this by lib/story/validate.ts.

/** The illustrations a scene may show: the app's own, already shipped. */
export const SCENE_IMAGES = [
  "/images/grand-library.webp",
  "/images/shadow-library.webp",
  "/images/forgotten-tower.webp",
  "/images/sealed-letter.webp",
  "/images/rune-chest.webp",
  "/images/glowing-chest.webp",
  "/images/rune-spellbook.webp",
  "/images/crystal-casket.webp",
  "/images/forest.webp",
  "/images/forest-spirit.webp",
  "/images/archive-mage.webp",
] as const;

const OPTION_ICONS = [
  "stairs",
  "park",
  "fort",
  "castle",
  "local_library",
  "restaurant",
  "nightlight",
  "skull",
  "water_drop",
  "door_front",
] as const;
const CHAPTER_ICONS = ["menu_book", "castle", "forest", "radar", "nightlight"] as const;
const CEFR = ["A1", "A2", "B1", "B2", "C1"] as const;

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const line = (max: number) => z.string().trim().min(1).max(max);
const text = (max = 400) => z.object({ ru: line(max), en: line(max) });
const optionalText = (max = 400) => z.object({ ru: z.string().max(max), en: z.string().max(max) });
const image = z.enum(SCENE_IMAGES);

const condition: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ flag: id }),
    z.object({ clue: id }),
    z.object({ not: condition }),
    z.object({ all: z.array(condition).max(8) }),
    z.object({ any: z.array(condition).max(8) }),
  ]),
);
const next = z.union([
  id,
  z
    .array(z.object({ when: condition, to: id }))
    .min(1)
    .max(6),
]);

const grimoire = z.object({
  title: text(120),
  minutes: z.number().int().min(1).max(15),
  rule: z.object({ heading: text(120), formula: line(120), text: text(400) }),
  deduction: text(400),
  quiz: z.object({ sentence: line(160).refine((s) => s.split("___").length === 2, "one ___"), options: z.array(line(40)).min(2).max(4) }),
});

const gloss = z
  .object({
    id,
    field: z.string().regex(/^(text|parchment|question|task|line:[0-7]|talk:[a-z0-9][a-z0-9-]{0,39})$/),
    start: z.number().int().min(0).max(600),
    end: z.number().int().min(1).max(600),
    phrase: line(80),
    ru: line(120),
    definition: z.string().trim().max(200).optional(),
    example: z.string().trim().max(160).optional(),
    note: optionalText(200).optional(),
    cefr: z.enum(CEFR).optional(),
    answer: z.boolean().optional(),
  })
  .refine((g) => g.end > g.start && g.end - g.start === g.phrase.length, "the mark's place and words disagree");
const base = { id, location: text(80), image, next: next.optional(), glosses: z.array(gloss).max(30).optional() };
/** A teacher's recording of the scene (its id in the teacher's media, lib/server/media.ts). */
const audio = z.string().uuid().optional();
const graded = {
  maxAttempts: z.number().int().min(1).max(5),
  xp: z.number().int().min(0).max(200),
  hint: z.object({ topic: text(60), text: text(300) }),
  grimoire,
  clue: id.optional(),
  objective: z.enum(OBJECTIVE_IDS as [Objective, ...Objective[]]).optional(),
};

const scene = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("narration"), text: line(600), translation: text(600), clue: id.optional(), audio }),
  z.object({
    ...base,
    kind: z.literal("dialogue"),
    lines: z
      .array(z.object({ speaker: text(60), text: line(300), translation: text(300) }))
      .min(1)
      .max(8),
    clue: id.optional(),
    audio,
  }),
  z.object({
    ...base,
    kind: z.literal("choice"),
    text: line(600),
    translation: text(600),
    prompt: text(200),
    options: z
      .array(z.object({ id, label: line(80), gloss: text(120), icon: z.enum(OPTION_ICONS), to: id, set: z.array(id).max(4).optional() }))
      .min(2)
      .max(4),
  }),
  z.object({
    ...base,
    ...graded,
    kind: z.literal("question"),
    parchment: line(300),
    translation: text(300),
    listen: z.boolean().optional(),
    audio,
    prompt: z.object({ lead: text(200), task: text(200) }),
    shuffle: z.boolean().optional(),
    options: z
      .array(z.object({ id, label: line(80), gloss: text(120), icon: z.enum(OPTION_ICONS) }))
      .min(2)
      .max(4),
  }),
  z.object({
    ...base,
    ...graded,
    kind: z.literal("puzzle"),
    parchment: line(300),
    translation: text(300),
    title: text(80),
    task: text(300),
    scroll: text(60),
    altar: text(60),
    tiles: z.array(line(40)).min(2).max(10),
  }),
  z.object({
    ...base,
    ...graded,
    kind: z.literal("evidence"),
    question: line(300),
    translation: text(300),
    prompt: text(200),
    clues: z.array(id).min(2).max(6),
    shuffle: z.boolean().optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("talk"),
    character: z.object({ name: text(60), image }),
    start: id,
    lines: z
      .array(
        z.object({
          id,
          text: line(300),
          translation: text(300),
          responses: z
            .array(
              z.object({
                id,
                text: line(160),
                gloss: text(160),
                to: z.union([id, z.literal("end")]),
                when: condition.optional(),
                set: z.array(id).max(4).optional(),
                clue: id.optional(),
              }),
            )
            .min(1)
            .max(4),
        }),
      )
      .min(1)
      .max(12),
    xp: z.number().int().min(0).max(200),
    clue: id.optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("search"),
    task: line(200),
    translation: text(200),
    // An app illustration; a teacher's own image once storage is connected (its id).
    picture: z.union([image, z.string().uuid()]),
    spots: z
      .array(
        z.object({
          id,
          label: line(60),
          gloss: text(80),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          w: z.number().min(0).max(1),
          h: z.number().min(0).max(1),
          found: optionalText(200),
        }),
      )
      .min(2)
      .max(10),
    hint: text(200),
    xp: z.number().int().min(0).max(200),
    clue: id.optional(),
    item: id.optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("dub"),
    exercise: z.string().regex(/^d-[a-z0-9-]{4,60}$/),
    text: line(300),
    translation: text(300),
    optional: z.boolean(),
    clue: id.optional(),
  }),
  z.object({
    ...base,
    kind: z.literal("ending"),
    title: text(80),
    text: line(600),
    translation: text(600),
    tone: z.enum(["bright", "bittersweet", "secret"]),
    reward: z.object({ xp: z.number().int().min(0).max(500), coins: z.number().int().min(0).max(200) }),
  }),
]);

const clue = z.object({
  id,
  title: text(80),
  english: line(80),
  location: text(80),
  image,
  description: text(400),
  phrase: z.object({ text: line(200), glosses: z.array(z.object({ word: line(40), meaning: text(80) })).max(6) }),
  tags: z.array(text(60)).max(4),
  deduction: text(300),
  teaser: text(160),
  onward: text(60),
});

const chapter = z.object({
  id,
  label: text(40),
  labelAccusative: text(40),
  title: text(80),
  subtitle: text(120),
  cefr: z.enum(CEFR),
  minutes: z.number().int().min(1).max(120),
  image,
  icon: z.enum(CHAPTER_ICONS),
  description: text(600),
  skills: text(200),
  mission: text(200),
  words: z.array(line(30)).max(12),
  gate: optionalText(80).optional(),
  reward: z.object({ xp: z.number().int().min(0).max(500), coins: z.number().int().min(0).max(200) }),
  scenes: z.array(scene).min(1).max(60),
});

export const campaignSchema = z.object({
  id: z.string().regex(/^t-[a-z0-9-]{4,60}$/),
  version: z.number().int().min(1),
  title: text(120),
  cefr: z.string().regex(/^(A1|A2|B1|B2|C1)(–(A1|A2|B1|B2|C1))?$/),
  requires: z.null(),
  quote: z.object({ text: optionalText(300), source: optionalText(120) }),
  chapters: z.array(chapter).min(1).max(8),
  clues: z.array(clue).max(30),
  caseNumber: z.number().int().min(1).max(999),
  support: z.enum(["auto", "all", "none"]).optional(),
  layout: z.record(id, z.object({ x: z.number().min(-5000).max(20000), y: z.number().min(-5000).max(20000) })).optional(),
});

const explanations = z.record(id, text(300));
export const keysSchema = z.record(
  id,
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("question"), correct: id, explanations, grimoire: line(40) }),
    z.object({ kind: z.literal("puzzle"), order: z.array(line(40)).min(2).max(10), explanation: text(300), grimoire: line(40) }),
    z.object({ kind: z.literal("evidence"), correct: z.array(id).min(1).max(6), explanations, grimoire: line(40) }),
    z.object({ kind: z.literal("search"), targets: z.array(id).min(1).max(9), ordered: z.boolean() }),
  ]),
);

/** A teacher's campaign and keys, or the first problem found in their shape. */
export function parseAuthored(
  graph: unknown,
  keys: unknown,
): { ok: true; campaign: Campaign; keys: CampaignKeys } | { ok: false; problem: string } {
  const g = campaignSchema.safeParse(graph);
  if (!g.success) return { ok: false, problem: `graph: ${g.error.issues[0]?.path.join(".")} ${g.error.issues[0]?.message}` };
  const k = keysSchema.safeParse(keys);
  if (!k.success) return { ok: false, problem: `keys: ${k.error.issues[0]?.path.join(".")} ${k.error.issues[0]?.message}` };
  return { ok: true, campaign: g.data as unknown as Campaign, keys: k.data as CampaignKeys };
}
