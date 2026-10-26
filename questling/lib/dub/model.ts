import { z } from "zod";
import type { Gloss } from "@/lib/learning/gloss";
import { glossProblems } from "@/lib/learning/gloss";

// Voice acting (features gate C): a teacher's short video scene, cut into timed dialogue lines, which
// students listen to and re-voice line by line, then submit for the teacher's review. A general
// mechanic (listen, record your own line, hear the scene with your voice), built in Questling's own
// design; nothing of any other product's branding or content.
//
// Content is versioned like campaigns: a published version never changes, so a submission always
// refers to the exact lines it voiced. Times are milliseconds from the start of the video file.

export const DUB_MODES = ["listen", "voiceover", "roleplay", "shadowing"] as const;
/**
 * listen — one line at a time: hear it, record it, compare;
 * voiceover — the student's character goes silent in the scene and their recordings take its place;
 * roleplay — the other characters' lines play, the student speaks theirs on cue;
 * shadowing — practice: repeat just after (or with) the original; never submitted, never graded.
 */
export type DubMode = (typeof DUB_MODES)[number];
export const SUBMITTED_MODES: DubMode[] = ["listen", "voiceover", "roleplay"];

export const SUBTITLES = ["en", "en_ru", "none"] as const;
export type Subtitles = (typeof SUBTITLES)[number];

export const RUBRIC = ["articulation", "pacing", "stress", "rhythm"] as const;
export type RubricItem = (typeof RUBRIC)[number];
/** A teacher's note per item: done well, or worth working on. No numbers, no scores. */
export type Rubric = Partial<Record<RubricItem, "good" | "work">>;

export type DubSpeaker = { id: string; name: string };
export type DubLine = {
  id: string;
  speaker: string;
  start: number;
  end: number;
  /** The English line, as spoken. */
  text: string;
  /** Its Russian translation (shown when the subtitles allow it). */
  ru: string;
  /** Word help on the line (lib/learning/gloss.ts), field "text". */
  glosses?: Gloss[];
};

export type DubContent = {
  title: string;
  description: string;
  /** What the teacher asks of the student, shown before they start. */
  instructions: string;
  cefr: "A1" | "A2" | "B1" | "B2" | "C1";
  /** The scene: a teacher's video (media id), or a built-in clip ("demo:<name>", the demo's own). */
  video: string;
  /** Optional sound without the voices (music, ambience), played under the student's recordings. */
  background?: string;
  /** The part of the video used (non-destructive: the file is not cut). */
  trim: { start: number; end: number };
  speakers: DubSpeaker[];
  lines: DubLine[];
  modes: DubMode[];
  subtitles: Subtitles;
  xp: number;
  /** How many times a student may submit (a teacher's "try again" uses one). */
  submissions: number;
  /** The teacher confirmed the video is their own or licensed for this use. */
  rights: boolean;
};

export const LIMITS = { speakers: 4, lines: 30, lineMs: 15_000, minLineMs: 400, text: 200, xp: 200, submissions: 5 } as const;

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const mediaRef = z.union([z.string().uuid(), z.string().regex(/^demo:[a-z0-9-]{1,40}$/)]);
const gloss = z.object({
  id,
  field: z.literal("text"),
  start: z.number().int().min(0).max(LIMITS.text),
  end: z.number().int().min(1).max(LIMITS.text),
  phrase: z.string().trim().min(1).max(80),
  ru: z.string().trim().min(1).max(120),
  definition: z.string().trim().max(200).optional(),
  example: z.string().trim().max(160).optional(),
  note: z.object({ ru: z.string().max(200), en: z.string().max(200) }).optional(),
  cefr: z.enum(["A1", "A2", "B1", "B2", "C1"]).optional(),
  answer: z.boolean().optional(),
});

export const dubSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400),
  instructions: z.string().trim().max(400),
  cefr: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  video: mediaRef,
  background: mediaRef.optional(),
  trim: z.object({ start: z.number().int().min(0).max(60_000), end: z.number().int().min(1).max(60_500) }),
  speakers: z
    .array(z.object({ id, name: z.string().trim().min(1).max(40) }))
    .min(1)
    .max(LIMITS.speakers),
  lines: z
    .array(
      z.object({
        id,
        speaker: id,
        start: z.number().int().min(0).max(60_500),
        end: z.number().int().min(1).max(60_500),
        text: z.string().trim().min(1).max(LIMITS.text),
        ru: z.string().trim().max(LIMITS.text),
        glosses: z.array(gloss).max(10).optional(),
      }),
    )
    .min(1)
    .max(LIMITS.lines),
  modes: z.array(z.enum(DUB_MODES)).min(1).max(4),
  subtitles: z.enum(SUBTITLES),
  xp: z.number().int().min(0).max(LIMITS.xp),
  submissions: z.number().int().min(1).max(LIMITS.submissions),
  rights: z.boolean(),
});

/** What is wrong with a scene before it can be published (empty: it can). `videoMs` is the file's real length, when known. */
export function dubProblems(content: DubContent, videoMs?: number): string[] {
  const p: string[] = [];
  const { trim } = content;
  if (!content.rights) p.push("rights: the video's rights are not confirmed");
  if (trim.end <= trim.start) p.push("trim: the end is before the start");
  if (videoMs !== undefined && trim.end > videoMs + 100) p.push("trim: past the end of the video");
  if (trim.end - trim.start > 60_000) p.push("trim: longer than a minute");
  const speakers = new Set(content.speakers.map((s) => s.id));
  if (speakers.size !== content.speakers.length) p.push("speakers: two share an id");
  const ids = new Set<string>();
  for (const line of content.lines) {
    if (ids.has(line.id)) p.push(`${line.id}: two lines share this id`);
    ids.add(line.id);
    if (!speakers.has(line.speaker)) p.push(`${line.id}: unknown speaker ${line.speaker}`);
    if (line.end - line.start < LIMITS.minLineMs) p.push(`${line.id}: shorter than ${LIMITS.minLineMs} ms or ends before it starts`);
    if (line.end - line.start > LIMITS.lineMs) p.push(`${line.id}: longer than ${LIMITS.lineMs / 1000} s`);
    if (line.start < trim.start || line.end > trim.end) p.push(`${line.id}: outside the trimmed scene`);
    for (const problem of glossProblems(line.text, line.glosses ?? [])) p.push(`${line.id}: ${problem}`);
  }
  // One speaker cannot say two lines at once; different speakers may overlap.
  for (const speaker of speakers) {
    const own = content.lines.filter((l) => l.speaker === speaker).sort((a, b) => a.start - b.start);
    own.forEach((line, i) => {
      if (i > 0 && line.start < own[i - 1].end) p.push(`${line.id}: overlaps ${own[i - 1].id} of the same speaker`);
    });
  }
  for (const speaker of content.speakers) if (!content.lines.some((l) => l.speaker === speaker.id)) p.push(`${speaker.id}: has no lines`);
  if (!content.modes.some((m) => SUBMITTED_MODES.includes(m)))
    p.push("modes: at least one mode the student submits (listen, voice-over or roleplay)");
  return p;
}

/** The lines a student voices for a role: all of them in "listen" mode, else their character's. */
export function roleLines(content: DubContent, role: string, mode: DubMode): DubLine[] {
  const ordered = [...content.lines].sort((a, b) => a.start - b.start);
  return mode === "listen" && content.speakers.length === 1 ? ordered : ordered.filter((l) => l.speaker === role);
}

/** A role the student may pick: one of the scene's speakers. With a single speaker there is nothing to pick. */
export const isRole = (content: DubContent, role: string) => content.speakers.some((s) => s.id === role);

/** Takes kept per line: the newest two; older ones are deleted from storage. */
export const TAKES_KEPT = 2;

export type DubVersion = {
  version: number;
  status: "draft" | "published";
  content: DubContent;
  updatedAt: string;
  publishedAt: string | null;
};

/** A teacher's scene and its versions (the newest last). */
export type DubExercise = {
  id: string;
  slug: string;
  title: string;
  cefr: DubContent["cefr"];
  createdAt: string;
  archivedAt: string | null;
  versions: DubVersion[];
};

export type DubAssignment = { id: string; groupId: string; exercise: string; version: number; dueAt: string | null; createdAt: string };

export type DubTake = { lineId: string; mediaId: string; createdAt: string };

export type SubmissionStatus = "recording" | "submitted" | "approved" | "retry";

/** A student's recording of one version of a scene: their role, their takes, and the teacher's review. */
export type DubSubmission = {
  id: string;
  userId: string;
  exercise: string;
  version: number;
  role: string;
  mode: Exclude<DubMode, "shadowing">;
  status: SubmissionStatus;
  attempts: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  feedback: string | null;
  rubric: Rubric | null;
  takes: DubTake[];
};

/** A scene as a student gets it: the assigned, published version. */
export type AssignedDub = { exercise: string; version: number; groupId: string; dueAt: string | null; content: DubContent };

/** The newest take of each line the student voices, or null when one is missing. */
export function latestTakes(content: DubContent, submission: Pick<DubSubmission, "role" | "mode" | "takes">): Map<string, DubTake> | null {
  const out = new Map<string, DubTake>();
  for (const line of roleLines(content, submission.role, submission.mode)) {
    const take = submission.takes.filter((t) => t.lineId === line.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!take) return null;
    out.set(line.id, take);
  }
  return out;
}

/** A built-in file for the demo and as a starting point: "demo:archive" → /media/demo/archive.mp4, others .m4a. */
export const builtInClip = (ref: string) => {
  if (!ref.startsWith("demo:")) return null;
  const name = ref.slice(5);
  // The scene itself is a video; its background and the demo takes are sound only.
  return name === "archive" ? `/media/demo/${name}.mp4` : `/media/demo/${name}.m4a`;
};

/** A new scene: the built-in archive clip with its two speakers, for the teacher to change or replace. */
export function starterDub(title: string, cefr: DubContent["cefr"]): DubContent {
  return {
    title,
    description: "",
    instructions: "",
    cefr,
    video: "demo:archive",
    trim: { start: 0, end: 18_000 },
    speakers: [
      { id: "eleanor", name: "Eleanor" },
      { id: "student", name: "Student" },
    ],
    lines: DEMO_ARCHIVE_LINES.map((l) => ({ ...l })),
    modes: ["listen", "voiceover", "roleplay", "shadowing"],
    subtitles: "en_ru",
    xp: 40,
    submissions: 3,
    rights: true,
  };
}

/** The lines of the built-in clip (public/media/demo/archive.mp4, made by scripts/build-demo-clip.ts). */
export const DEMO_ARCHIVE_LINES: DubLine[] = [
  {
    id: "l1",
    speaker: "eleanor",
    start: 600,
    end: 3600,
    text: "Welcome to the archive. Please, keep your voice down.",
    ru: "Добро пожаловать в архив. Пожалуйста, говорите тише.",
  },
  { id: "l2", speaker: "student", start: 4200, end: 6600, text: "I'm sorry. I'm looking for a map.", ru: "Простите. Я ищу карту." },
  {
    id: "l3",
    speaker: "eleanor",
    start: 7200,
    end: 10400,
    text: "The old maps are on the top shelf, behind the candles.",
    ru: "Старые карты на верхней полке, за свечами.",
  },
  {
    id: "l4",
    speaker: "student",
    start: 11000,
    end: 13200,
    text: "Thank you. Can I take one home?",
    ru: "Спасибо. Можно взять одну домой?",
  },
  {
    id: "l5",
    speaker: "eleanor",
    start: 13800,
    end: 17200,
    text: "No. The maps never leave this room.",
    ru: "Нет. Карты никогда не покидают эту комнату.",
  },
];
