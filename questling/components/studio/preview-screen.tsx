"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { PlayScreen } from "@/components/student/play-screen";
import { StudentProvider, type ActResult } from "@/lib/client/student";
import { AudioNotice } from "@/components/student/line-audio";
import { useStudio } from "@/lib/client/studio";
import { applyEffects, emptyFacts, type Facts } from "@/lib/game/facts";
import { run, type Action } from "@/lib/game/ops";
import { getDictionary } from "@/lib/i18n";
import { StudioShell } from "./studio-shell";

// "Предпросмотр (Telegram)" of 18_quest_builder: the saved draft played as a student would play it,
// inside a phone-sized frame. A sandbox: a fresh student whose only assignment is this draft, the
// answers checked with the draft's own keys, everything kept in memory and gone on leaving — no
// run, answer or reward is written anywhere. The frame is transformed, so the player's fixed bars
// stay inside it.

export function PreviewScreen({ questId }: { questId: string }) {
  const { t, base, facts } = useStudio();
  const quest = facts.quests.find((q) => q.id === questId);
  const version = quest ? (quest.versions.find((v) => v.status === "draft") ?? quest.versions.at(-1)) : undefined;
  return (
    <StudioShell section="builder" title={t.builder.previewTitle}>
      <div className="gap-space-lg flex flex-col items-center">
        <div className="gap-space-md flex w-full max-w-3xl flex-wrap items-center justify-between">
          <div className="flex flex-col">
            <h2 className="font-headline-md text-headline-md text-text-ivory">
              {t.builder.previewTitle}
              {quest && version ? ` • ${quest.title} v${version.version}` : ""}
            </h2>
            <p className="font-body-md text-body-md text-text-muted">{t.builder.previewNote}</p>
          </div>
          <a
            href={`${base}/builder?quest=${questId}`}
            className="gap-space-xs px-space-md py-space-sm bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-md text-label-md flex items-center rounded-lg"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            <span>{t.builder.previewBack}</span>
          </a>
        </div>
        {quest && version ? (
          <div
            className="ring-surface-container-high relative h-[780px] w-[390px] overflow-hidden rounded-[2.5rem] shadow-2xl ring-8"
            style={{ transform: "translateZ(0)" }}
            data-preview={questId}
          >
            <div className="h-full overflow-y-auto">
              <Sandbox
                key={`${quest.id}@${version.version}@${version.updatedAt}`}
                graph={version.graph}
                keys={version.keys}
                questId={questId}
              />
            </div>
          </div>
        ) : (
          <p className="font-body-md text-body-md text-text-muted">{t.builder.previewMissing}</p>
        )}
      </div>
    </StudioShell>
  );
}

type Version = NonNullable<ReturnType<typeof useStudio>["facts"]["quests"][number]["versions"][number]>;

function Sandbox({ graph, keys, questId }: { graph: Version["graph"]; keys: Version["keys"]; questId: string }) {
  const { locale, base, facts: studio } = useStudio();
  const [facts, setFacts] = useState<Facts>(() => {
    const fresh = emptyFacts(new Date().toISOString());
    return {
      ...fresh,
      profile: { ...fresh.profile, heroName: "Preview", characterId: "cat" },
      world: {
        groups: [],
        assignments: [{ groupId: "preview", campaign: graph.id, version: graph.version, dueAt: null }],
        campaigns: [graph],
        messages: [],
        // The teacher's own recordings play in the preview as they will for a student.
        media: Object.fromEntries(studio.media.map((m) => [m.id, m.url])),
      },
    };
  });
  const latest = useRef(facts);
  const act = useCallback(
    async (action: Action): Promise<ActResult> => {
      const now = new Date();
      const result = run(latest.current, action, { now, locale, demo: true, keys: (c) => (c.id === graph.id ? keys : null) });
      if (!result.ok) return result;
      latest.current = applyEffects(latest.current, result.effects, now.toISOString());
      setFacts(latest.current);
      return { ok: true, outcome: result.outcome };
    },
    [graph.id, keys, locale],
  );
  const api = useMemo(
    () => ({
      mode: "demo" as const,
      locale,
      t: getDictionary(locale),
      base: `${base}/preview/${questId}`,
      facts,
      account: { telegram: null, group: null },
      act,
    }),
    [locale, base, questId, facts, act],
  );
  return (
    <StudentProvider value={api}>
      <PlayScreen campaignId={graph.id} />
      <AudioNotice />
    </StudentProvider>
  );
}
