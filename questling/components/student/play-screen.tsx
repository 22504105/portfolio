"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { tr } from "@/lib/content/text";
import { useStudent } from "@/lib/client/student";
import type { Facts } from "@/lib/game/facts";
import type { Outcome } from "@/lib/game/ops";
import { campaignFinished, campaignOpen, completed, currentChapter, playedCampaign, runOf } from "@/lib/game/stats";
import { findCampaign, studentCampaigns, worldOf } from "@/lib/game/world";
import { isGraded, type Campaign } from "@/lib/story/graph";
import { locate, sceneProgress, runSeed, startRun, type Move } from "@/lib/story/run";
import { puzzleNode, questHref, questionNode, sceneGlosses } from "@/lib/student/story";
import { PuzzleScreen } from "./puzzle-screen";
import { ChapterDoneScreen, ChoiceScreen, DialogueScreen, EndingScreen, NarrationScreen, type Frame } from "./story-scenes";
import { StoryPlayer, type Help } from "./story-player";

// The story player route: the scene the student's run is at, of whatever kind, played through
// the rules (lib/game/ops.ts, "story"). The campaign is fixed while on screen, so its ending
// stays in view after the run is over; a solved scene stays (with its reward) until the student
// moves on, and a finished chapter shows its reward before the next one starts. The run is kept
// by the store, so leaving and coming back resumes at the same scene, attempts and all.

/** The campaign to play: the one named, else the current one, else the last one played. */
function pick(facts: Facts, named?: string): Campaign | null {
  if (named) return findCampaign(facts, named);
  const list = studentCampaigns(facts);
  return currentChapter(facts)?.campaign ?? [...list].reverse().find((c) => runOf(facts, c.id)) ?? list[0];
}

export function PlayScreen({ campaignId }: { campaignId?: string }) {
  const { t, locale, base, facts, act, account } = useStudent();
  const router = useRouter();
  const [id] = useState(() => pick(facts, campaignId)?.id ?? null);
  const latest = id ? (findCampaign(facts, id) ?? undefined) : undefined;
  const open = latest ? campaignOpen(facts, latest) : false;
  const campaign = latest && open ? playedCampaign(facts, latest) : null;
  const run = campaign ? (runOf(facts, campaign.id) ?? startRun(campaign, runSeed(facts.profile.joinedAt, campaign))) : null;
  const target = run ? (run.ending ?? run.scene) : null;

  // What is on screen is worked out from the run, never from the timing of an answer's reply:
  // the scene last shown stays while it is a graded scene the run has solved (its reward is in
  // view) until "next"; a chapter finished since the screen opened shows its reward before the
  // next one. Both survive however the store's update and React's rendering interleave.
  const [shown, setShown] = useState(target);
  const [seen, setSeen] = useState<string[]>(() => run?.chapters ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!latest || !open) router.replace(`${base}/map`);
  }, [latest, open, router, base]);

  if (!campaign || !run || !target) return <div className="bg-background min-h-dvh" aria-busy="true"></div>;

  const shownScene = shown ? locate(campaign, shown)?.scene : undefined;
  const holding = shown !== target && !!shownScene && isGraded(shownScene) && sceneProgress(run, shownScene.id).solved;
  // Following the run: React allows this update during render, it settles at once.
  if (!holding && shown !== target) setShown(target);
  const interlude = !holding && !run.ending ? (run.chapters.find((c) => !seen.includes(c)) ?? null) : null;

  const here = locate(campaign, holding ? shown! : target);
  if (!here) return <div className="bg-background min-h-dvh" aria-busy="true"></div>;
  const { chapter, scene } = here;

  const backHref = questHref(base, campaign, chapter);
  const profileHref = `${base}/profile`;
  const mapHref = `${base}/map`;
  const frame: Frame = {
    chapter: tr(chapter.label, locale),
    cefr: chapter.cefr,
    storyTitle: tr(chapter.title, locale),
    location: tr(scene.location, locale),
    image: scene.image,
  };

  const send = async (move: Move): Promise<Extract<Outcome, { kind: "story" }>> => {
    const result = await act({ type: "story", campaign: campaign.id, move });
    if (!result.ok || result.outcome.kind !== "story") throw new Error(result.ok ? "unexpected outcome" : result.refusal);
    return result.outcome;
  };

  /** A read scene's move: the story goes on at once. */
  const pass = async (move: Move) => {
    setPending(true);
    setError(false);
    try {
      await send(move);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  /** A graded scene's answer, as recorded by the rules. */
  const answer = async (given: string | string[]) => {
    const outcome = await send({ type: "answer", scene: scene.id, answer: given });
    if (!outcome.answer) throw new Error("not graded");
    return outcome.answer;
  };

  /** "Next" after a solved scene: on to where the run is. */
  const next = () => {
    setShown(target);
  };

  const reply = worldOf(facts).messages.find((m) => m.ref === `${campaign.id}/${scene.id}`) ?? null;
  const help: Help = {
    group: account.group?.name ?? null,
    asked: completed(facts, "help_request", `${campaign.id}/${scene.id}`),
    reply: reply && { body: reply.body, mentor: reply.mentor },
    onAsk: async () => (await act({ type: "askMentor", campaign: campaign.id, scene: scene.id })).ok,
    onStudy: async (word) => Boolean((await send({ type: "grimoire", scene: scene.id, word })).grimoire?.correct),
  };

  const screen = () => {
    if (interlude) {
      const done = campaign.chapters.find((c) => c.id === interlude)!;
      return (
        <ChapterDoneScreen
          t={t}
          frame={{ ...frame, chapter: tr(done.label, locale), cefr: done.cefr, storyTitle: tr(done.title, locale), image: done.image }}
          backHref={backHref}
          profileHref={profileHref}
          title={tr(done.title, locale)}
          reward={done.reward}
          onNext={() => setSeen(run.chapters)}
        />
      );
    }

    const common = { t, frame, backHref, profileHref, pending, error, glosses: sceneGlosses(campaign, chapter, scene, locale) };
    const clueTitle = (clue?: string) => {
      const found = clue ? campaign.clues.find((c) => c.id === clue) : null;
      return found ? tr(found.title, locale) : null;
    };

    switch (scene.kind) {
      case "narration":
        return (
          <NarrationScreen
            key={scene.id}
            {...common}
            text={scene.text}
            translation={tr(scene.translation, locale)}
            clue={clueTitle(scene.clue)}
            audio={scene.audio}
            onNext={() => pass({ type: "advance", scene: scene.id })}
          />
        );
      case "dialogue":
        return (
          <DialogueScreen
            key={scene.id}
            {...common}
            lines={scene.lines.map((line) => ({
              speaker: tr(line.speaker, locale),
              text: line.text,
              translation: tr(line.translation, locale),
            }))}
            clue={clueTitle(scene.clue)}
            audio={scene.audio}
            onNext={() => pass({ type: "advance", scene: scene.id })}
          />
        );
      case "choice":
        return (
          <ChoiceScreen
            key={scene.id}
            {...common}
            text={scene.text}
            translation={tr(scene.translation, locale)}
            prompt={tr(scene.prompt, locale)}
            options={scene.options.map((o) => ({ id: o.id, label: o.label, gloss: tr(o.gloss, locale), icon: o.icon }))}
            onChoose={(option) => pass({ type: "choose", scene: scene.id, option })}
          />
        );
      case "ending": {
        const following = studentCampaigns(facts).find((c) => c.requires === campaign.id);
        return (
          <EndingScreen
            key={scene.id}
            t={t}
            frame={frame}
            backHref={backHref}
            profileHref={profileHref}
            title={tr(scene.title, locale)}
            tone={scene.tone}
            glosses={common.glosses}
            text={scene.text}
            translation={tr(scene.translation, locale)}
            endings={campaign.chapters.flatMap((c) => c.scenes).filter((s) => s.kind === "ending").length}
            reward={scene.reward}
            campaign={tr(campaign.title, locale)}
            nextCampaign={following && campaignFinished(facts, campaign.id) ? tr(following.title, locale) : null}
            links={{ journal: `${base}/journal/${campaign.id}`, map: mapHref, play: following ? `${base}/play/${following.id}` : mapHref }}
          />
        );
      }
    }

    // Graded scenes: a question or a piece of evidence (05), or a cipher (06).
    if (!isGraded(scene)) return null;
    const progress = sceneProgress(run, scene.id);
    if (scene.kind === "puzzle")
      return (
        <PuzzleScreen
          key={scene.id}
          node={puzzleNode(campaign, chapter, scene, run, locale)}
          attemptsUsed={progress.used}
          grade={(tiles) => answer(tiles)}
          onNext={next}
          help={help}
        />
      );
    return (
      <StoryPlayer
        key={scene.id}
        t={t}
        node={questionNode(campaign, chapter, scene, run, locale)}
        initial={{ attemptsUsed: progress.used, eliminated: progress.eliminated }}
        grade={async (_id, optionId) => ({ optionId, ...(await answer(optionId)) })}
        backHref={backHref}
        profileHref={profileHref}
        onNext={next}
        exitHref={mapHref}
        help={help}
      />
    );
  };

  // Which scene is on screen, for tests and visual QA; `contents` keeps it out of the layout.
  return (
    <div className="contents" data-play-scene={interlude ? `chapter-done:${interlude}` : scene.id}>
      {screen()}
    </div>
  );
}
