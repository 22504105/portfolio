"use client";

import { StoryPlayer, type Grader } from "@/components/student/story-player";
import { demoStory } from "@/lib/demo/story";
import type { Dictionary, Locale } from "@/lib/i18n";
import { grade } from "@/lib/story/engine";

// The demo grades in the browser: its answer key ships with the page, which is
// acceptable only because the demo stores nothing and earns nothing.
export function DemoStoryPlayer({ locale, t }: { locale: Locale; t: Dictionary }) {
  const story = demoStory(locale);
  const demoGrader: Grader = async (_nodeId, optionId) => grade(story.key, optionId);
  const base = `/${locale}/demo`;
  return (
    <StoryPlayer
      t={t}
      node={story.question}
      grade={demoGrader}
      hint={story.key.hint}
      clueTranslation={story.clueTranslation}
      backHref={`${base}/home`}
      profileHref={`${base}/profile`}
      nextHref={`${base}/home`}
    />
  );
}
