"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { nodeById, storyNode } from "@/lib/content/campaign";
import { useStudent } from "@/lib/client/student";
import type { Facts } from "@/lib/game/facts";
import { currentChapter, nextNode } from "@/lib/game/stats";
import { PuzzleScreen } from "./puzzle-screen";
import { StoryPlayer, type Grader } from "./story-player";

// The story player route: the next node of the chapter being played, a question (05) or a
// cipher (06). The node is fixed while it is on screen, so a right answer's reward stays in view
// until "К следующей улике" moves on; when the chapter has no node left, the journal opens.

const pick = (facts: Facts) => {
  const chapter = currentChapter(facts);
  return (chapter && nextNode(facts, chapter)?.id) ?? null;
};

export function PlayScreen() {
  const { t, locale, base, facts, act } = useStudent();
  const router = useRouter();
  const [nodeId, setNodeId] = useState<string | null>(() => pick(facts));
  const node = nodeId ? storyNode(nodeId, locale) : null;

  useEffect(() => {
    if (!nodeId) router.replace(`${base}/journal`);
  }, [nodeId, router, base]);

  if (!node) return <div className="bg-background min-h-dvh" aria-busy="true"></div>;
  if (node.kind === "puzzle") return <PuzzleScreen key={node.id} node={node} />;

  const chapterId = nodeById.get(node.id)!.chapter.id;
  const grade: Grader = async (_id, optionId) => {
    const result = await act({ type: "answerStory", nodeId: node.id, answer: optionId });
    if (!result.ok || result.outcome.kind !== "story") throw new Error("not graded");
    return result.outcome.result;
  };

  return (
    <StoryPlayer
      key={node.id}
      t={t}
      node={node}
      grade={grade}
      backHref={`${base}/quest/${chapterId}`}
      profileHref={`${base}/profile`}
      nextHref={`${base}/journal`}
      onNext={() => setNodeId(pick(facts))}
      exitHref={`${base}/map`}
    />
  );
}
