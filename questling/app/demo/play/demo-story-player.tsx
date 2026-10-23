"use client";

import { StoryPlayer, type Grader } from "@/components/student/story-player";
import { demoClueTranslation, demoQuestion, demoQuestionKey } from "@/lib/demo/story";
import { grade } from "@/lib/story/engine";

// The demo grades in the browser: its answer key ships with the page, which is
// acceptable only because the demo stores nothing and earns nothing.
const demoGrader: Grader = async (_nodeId, optionId) => grade(demoQuestionKey, optionId);

export function DemoStoryPlayer() {
  return (
    <StoryPlayer
      node={demoQuestion}
      grade={demoGrader}
      hint={demoQuestionKey.hint}
      clueTranslation={demoClueTranslation}
      backHref="/demo/home"
      profileHref="/demo/profile"
      nextHref="/demo/home"
    />
  );
}
