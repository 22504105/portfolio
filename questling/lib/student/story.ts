import { tr } from "@/lib/content/text";
import type { Locale } from "@/lib/i18n";
import type { Campaign, Chapter, EvidenceScene, Grimoire, PuzzleScene, QuestionScene, Scene } from "@/lib/story/graph";
import { isGraded } from "@/lib/story/graph";
import { attemptsAllowed, sceneProgress, type RunState } from "@/lib/story/run";
import type { GrimoireView, PuzzleNode, QuestionNode } from "@/lib/story/types";

// Scenes of the campaign graph as the player screens show them, in the interface language.
// No answer keys here: the signed-in student's page builds these too.

/** The scene's English line: what the map, the chapter page and the parchments quote. */
export function sceneLine(scene: Scene): string {
  switch (scene.kind) {
    case "narration":
    case "choice":
    case "ending":
      return scene.text;
    case "dialogue":
      return scene.lines[0].text;
    case "question":
    case "puzzle":
      return scene.parchment;
    case "evidence":
      return scene.question;
  }
}

/** Where a graded scene stands among its chapter's graded scenes, 1-based. */
export function stepOf(chapter: Chapter, sceneId: string): { index: number; total: number } {
  const graded = chapter.scenes.filter(isGraded);
  return { index: graded.findIndex((s) => s.id === sceneId) + 1, total: graded.length };
}

export function grimoireView(grimoire: Grimoire, locale: Locale): GrimoireView {
  return {
    title: tr(grimoire.title, locale),
    minutes: grimoire.minutes,
    heading: tr(grimoire.rule.heading, locale),
    formula: grimoire.rule.formula,
    text: tr(grimoire.rule.text, locale),
    deduction: tr(grimoire.deduction, locale),
    quiz: grimoire.quiz,
  };
}

function frame(campaign: Campaign, chapter: Chapter, scene: QuestionScene | PuzzleScene | EvidenceScene, run: RunState, locale: Locale) {
  const clue = scene.clue ? campaign.clues.find((c) => c.id === scene.clue) : null;
  const text = scene.kind === "evidence" ? scene.question : scene.parchment;
  return {
    id: scene.id,
    chapter: tr(chapter.label, locale),
    cefr: chapter.cefr,
    storyTitle: tr(chapter.title, locale),
    subtitle: tr(chapter.subtitle, locale),
    location: tr(scene.location, locale),
    image: scene.image,
    clue: { ...stepOf(chapter, scene.id), text, title: clue ? tr(clue.title, locale) : null },
    translation: tr(scene.translation, locale),
    maxAttempts: attemptsAllowed(scene, sceneProgress(run, scene.id)),
    reward: { xp: scene.xp },
    grimoire: grimoireView(scene.grimoire, locale),
  };
}

export function questionNode(
  campaign: Campaign,
  chapter: Chapter,
  scene: QuestionScene | EvidenceScene,
  run: RunState,
  locale: Locale,
): QuestionNode {
  const hint = { topic: tr(scene.hint.topic, locale), text: tr(scene.hint.text, locale) };
  if (scene.kind === "question")
    return {
      ...frame(campaign, chapter, scene, run, locale),
      kind: "question",
      prompt: { lead: tr(scene.prompt.lead, locale), task: tr(scene.prompt.task, locale) },
      options: scene.options.map((o) => ({ id: o.id, label: o.label, gloss: tr(o.gloss, locale), icon: o.icon })),
      hint,
      evidence: false,
    };
  // Evidence: only the offered clues the student has found can be shown.
  const found = scene.clues.filter((id) => run.clues.includes(id)).map((id) => campaign.clues.find((c) => c.id === id)!);
  return {
    ...frame(campaign, chapter, scene, run, locale),
    kind: "question",
    prompt: { lead: tr(scene.prompt, locale), task: "" },
    options: found.map((clue) => ({
      id: clue.id,
      label: clue.english,
      gloss: tr(clue.title, locale),
      icon: "local_library",
      image: clue.image,
    })),
    hint,
    evidence: true,
  };
}

export function puzzleNode(campaign: Campaign, chapter: Chapter, scene: PuzzleScene, run: RunState, locale: Locale): PuzzleNode {
  return {
    ...frame(campaign, chapter, scene, run, locale),
    kind: "puzzle",
    title: tr(scene.title, locale),
    task: tr(scene.task, locale),
    scroll: tr(scene.scroll, locale),
    altar: tr(scene.altar, locale),
    tiles: scene.tiles,
    hint: tr(scene.hint.text, locale),
  };
}

/** The chapter whose scene reveals a clue. */
export function clueChapter(campaign: Campaign, clueId: string): Chapter {
  return (
    campaign.chapters.find((chapter) => chapter.scenes.some((scene) => "clue" in scene && scene.clue === clueId)) ?? campaign.chapters[0]
  );
}

/** The chapter page of a chapter: built-in chapters by id, a teacher's with its campaign named (their ids may repeat). */
export const questHref = (base: string, campaign: Campaign, chapter: Chapter) =>
  campaign.id.startsWith("t-") ? `${base}/quest/${chapter.id}?c=${campaign.id}` : `${base}/quest/${chapter.id}`;
