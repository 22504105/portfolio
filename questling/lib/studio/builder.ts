import type { Campaign, CampaignKeys, Next, Scene } from "@/lib/story/graph";

// The builder's edits to a draft, as pure functions over { graph, keys }: adding a scene of a
// palette kind after the selected one, removing or moving one (transitions to it are re-pointed),
// and the canvas's picture of the graph — where each scene is drawn and which arrows join them.
// The builder sends the result as the draft; the server checks it again (lib/story/schema.ts).

export type Draft = { graph: Campaign; keys: CampaignKeys };

export type PaletteKind =
  | "narration"
  | "dialogue"
  | "clue"
  | "question"
  | "fill"
  | "puzzle"
  | "listen"
  | "evidence"
  | "choice"
  | "condition"
  | "talk"
  | "search"
  | "dub"
  | "ending";

const t = (ru: string, en: string) => ({ ru, en });
const base = (id: string) => ({ id, location: t("Библиотека", "The library"), image: "/images/grand-library.webp" });
const grimoire = () => ({
  title: t("Гримуар", "The grimoire"),
  minutes: 1,
  rule: { heading: t("Правило:", "The rule:"), formula: "[ON] the table", text: t("Объясните правило.", "Explain the rule.") },
  deduction: t("Что подсказывает текст?", "What does the text tell us?"),
  quiz: { sentence: "The cat is ___ the chair.", options: ["on", "of", "at"] },
});
const graded = () => ({
  maxAttempts: 2,
  xp: 50,
  hint: { topic: t("Лексика", "Vocabulary"), text: t("Подсказка.", "A hint.") },
  grimoire: grimoire(),
});

/** A fresh id not used by any scene: "question-2", "ending-3"... */
export function freshId(graph: Campaign, stem: string): string {
  const used = new Set(graph.chapters.flatMap((c) => c.scenes.map((s) => s.id)));
  for (let n = 1; ; n++) if (!used.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

/** A new scene of a palette kind, with its answer key if it is graded. */
export function newScene(graph: Campaign, kind: PaletteKind, after: Scene | undefined): { scene: Scene; key?: CampaignKeys[string] } {
  const stem = kind === "clue" ? "clue-scene" : kind === "fill" || kind === "listen" ? "question" : kind === "condition" ? "check" : kind;
  const id = freshId(graph, stem);
  switch (kind) {
    case "narration":
    case "clue":
      return {
        scene: {
          ...base(id),
          kind: "narration",
          text: "You walk into the hall.",
          translation: t("Ты входишь в зал.", "You walk into the hall."),
          ...(kind === "clue" && graph.clues[0] ? { clue: graph.clues[0].id, image: "/images/sealed-letter.webp" } : {}),
        },
      };
    case "condition": {
      const target = after ? nextOf(graph, after.id) : null;
      return {
        scene: {
          ...base(id),
          kind: "narration",
          text: "You stop and think.",
          translation: t("Ты останавливаешься и думаешь.", "You stop and think."),
          ...(target ? { next: [{ when: { all: [] }, to: target }] } : {}),
        },
      };
    }
    case "dialogue":
      return {
        scene: {
          ...base(id),
          kind: "dialogue",
          image: "/images/archive-mage.webp",
          lines: [
            {
              speaker: t("Архивариус", "The Archivist"),
              text: "Welcome, seeker.",
              translation: t("Добро пожаловать, искатель.", "Welcome, seeker."),
            },
          ],
        },
      };
    case "choice": {
      const target = after ? nextOf(graph, after.id) : null;
      const to = target ?? graph.chapters[0].scenes[0].id;
      return {
        scene: {
          ...base(id),
          kind: "choice",
          text: "Two doors are in front of you.",
          translation: t("Перед тобой две двери.", "Two doors are in front of you."),
          prompt: t("Куда пойти?", "Where to go?"),
          options: [
            { id: "left", label: "The left door", gloss: t("Левая дверь", "The left door"), icon: "door_front", to },
            { id: "right", label: "The right door", gloss: t("Правая дверь", "The right door"), icon: "door_front", to },
          ],
        },
      };
    }
    case "question":
    case "fill":
    case "listen":
      return {
        scene: {
          ...base(id),
          kind: "question",
          image: "/images/shadow-library.webp",
          parchment: kind === "fill" ? "The book is ___ the table." : "The book is on the table.",
          translation: t("Книга на столе.", "The book is on the table."),
          ...(kind === "listen" ? { listen: true } : {}),
          prompt: {
            lead: t("Прочитай записку.", "Read the note."),
            task: kind === "fill" ? t("Какое слово пропущено?", "Which word is missing?") : t("Где книга?", "Where is the book?"),
          },
          options:
            kind === "fill"
              ? [
                  { id: "on", label: "on", gloss: t("на", "on"), icon: "local_library" },
                  { id: "of", label: "of", gloss: t("из", "of"), icon: "stairs" },
                ]
              : [
                  { id: "table", label: "On the table", gloss: t("На столе", "On the table"), icon: "local_library" },
                  { id: "floor", label: "On the floor", gloss: t("На полу", "On the floor"), icon: "stairs" },
                ],
          ...graded(),
        },
        key: {
          kind: "question",
          correct: kind === "fill" ? "on" : "table",
          explanations:
            kind === "fill"
              ? { on: t("Верно.", "Right."), of: t("Не то слово.", "Not that word.") }
              : { table: t("Верно.", "Right."), floor: t("Перечитай записку.", "Read the note again.") },
          grimoire: "on",
        },
      };
    case "puzzle":
      return {
        scene: {
          ...base(id),
          kind: "puzzle",
          image: "/images/rune-chest.webp",
          parchment: "The key is under the stone.",
          translation: t("Ключ под камнем.", "The key is under the stone."),
          title: t("Шифр", "The cipher"),
          task: t("Собери фразу.", "Put the phrase together."),
          scroll: t("Свиток", "The scroll"),
          altar: t("Алтарь", "The altar"),
          tiles: ["stone", "The", "key", "under", "is", "the"],
          ...graded(),
        },
        key: {
          kind: "puzzle",
          order: ["The", "key", "is", "under", "the", "stone"],
          explanation: t("The key is under the stone.", "The key is under the stone."),
          grimoire: "on",
        },
      };
    case "evidence": {
      const clues = graph.clues.map((c) => c.id).slice(0, 3);
      return {
        scene: {
          ...base(id),
          kind: "evidence",
          question: "Which clue proves it?",
          translation: t("Какая улика это доказывает?", "Which clue proves it?"),
          prompt: t("Выбери улику.", "Pick a clue."),
          clues,
          ...graded(),
        },
        key: {
          kind: "evidence",
          correct: clues.slice(0, 1),
          explanations: Object.fromEntries(clues.map((c) => [c, t("Пояснение.", "Why.")])),
          grimoire: "on",
        },
      };
    }
    case "talk":
      return {
        scene: {
          ...base(id),
          kind: "talk",
          image: "/images/archive-mage.webp",
          character: { name: t("Архивариус", "The Archivist"), image: "/images/archive-mage.webp" },
          start: "hello",
          lines: [
            {
              id: "hello",
              text: "You again? What do you want to know?",
              translation: t("Снова ты? Что ты хочешь узнать?", "You again? What do you want to know?"),
              responses: [
                {
                  id: "ask",
                  text: "Where were you last night?",
                  gloss: t("Где вы были вчера ночью?", "Where were you last night?"),
                  to: "night",
                },
                { id: "bye", text: "Nothing. Goodbye.", gloss: t("Ничего. До свидания.", "Nothing. Goodbye."), to: "end" },
              ],
            },
            {
              id: "night",
              text: "I was in the archive until midnight.",
              translation: t("Я была в архиве до полуночи.", "I was in the archive until midnight."),
              responses: [{ id: "thanks", text: "Thank you.", gloss: t("Спасибо.", "Thank you."), to: "end" }],
            },
          ],
          xp: 10,
        },
      };
    case "search":
      return {
        scene: {
          ...base(id),
          kind: "search",
          image: "/images/grand-library.webp",
          task: "Find the open book.",
          translation: t("Найди открытую книгу.", "Find the open book."),
          picture: "/images/grand-library.webp",
          spots: [
            {
              id: "book",
              label: "the open book",
              gloss: t("открытая книга", "the open book"),
              x: 0.62,
              y: 0.66,
              w: 0.16,
              h: 0.14,
              found: t("Вот она!", "There it is!"),
            },
            {
              id: "window",
              label: "the window",
              gloss: t("окно", "the window"),
              x: 0.78,
              y: 0.12,
              w: 0.16,
              h: 0.4,
              found: t("Это окно.", "That is the window."),
            },
          ],
          hint: t("Посмотри на стол у окна.", "Look at the desk by the window."),
          xp: 15,
        },
        key: { kind: "search", targets: ["book"], ordered: false },
      };
    case "dub":
      return {
        scene: {
          ...base(id),
          kind: "dub",
          exercise: "d-choose-a-scene",
          text: "Speak for the archivist.",
          translation: t("Озвучь архивариуса.", "Speak for the archivist."),
          optional: true,
        },
      };
    case "ending":
      return {
        scene: {
          ...base(id),
          kind: "ending",
          title: t("Финал", "The end"),
          text: "The mystery is solved.",
          translation: t("Тайна раскрыта.", "The mystery is solved."),
          tone: "bright",
          reward: { xp: 50, coins: 10 },
        },
      };
  }
}

/** Where a scene leads when it does not choose: its own next, else the scene after it in play order. */
export function nextOf(graph: Campaign, id: string): string | null {
  const all = graph.chapters.flatMap((c) => c.scenes);
  const i = all.findIndex((s) => s.id === id);
  const scene = all[i];
  if (!scene || scene.kind === "ending" || scene.kind === "choice") return null;
  if (typeof scene.next === "string") return scene.next;
  if (Array.isArray(scene.next)) return scene.next.at(-1)?.to ?? null;
  return all[i + 1]?.id ?? null;
}

const where = (graph: Campaign, id: string) => {
  for (const [c, chapter] of graph.chapters.entries()) {
    const s = chapter.scenes.findIndex((x) => x.id === id);
    if (s >= 0) return { c, s };
  }
  return null;
};

/** Adds a scene right after `afterId` (or at the end of the first chapter). */
export function addScene(draft: Draft, kind: PaletteKind, afterId: string | null): { draft: Draft; id: string } {
  const graph = structuredClone(draft.graph);
  const keys = structuredClone(draft.keys);
  const at = afterId ? where(graph, afterId) : null;
  const chapter = graph.chapters[at?.c ?? graph.chapters.length - 1];
  const after = at ? chapter.scenes[at.s] : chapter.scenes.at(-1);
  // An ending is the last scene of a story: anything added "after" it goes before it.
  const index = at
    ? after?.kind === "ending"
      ? at.s
      : at.s + 1
    : chapter.scenes.at(-1)?.kind === "ending"
      ? chapter.scenes.length - 1
      : chapter.scenes.length;
  const { scene, key } = newScene(graph, kind, after?.kind === "ending" ? undefined : after);
  chapter.scenes.splice(index, 0, scene);
  // A scene that pointed straight past the new one now leads into it (only a plain "next").
  if (after && after.kind !== "ending" && typeof after.next === "string" && index === (at?.s ?? -1) + 1) {
    if (scene.kind !== "ending" && scene.kind !== "choice" && scene.next === undefined) scene.next = after.next;
    after.next = scene.id;
  }
  if (key) keys[scene.id] = key;
  return { draft: { graph, keys }, id: scene.id };
}

/** Removes a scene; whatever led to it now leads where it led. Refuses the last scene of a chapter. */
export function removeScene(draft: Draft, id: string): Draft | null {
  const graph = structuredClone(draft.graph);
  const at = where(graph, id);
  if (!at || graph.chapters[at.c].scenes.length <= 1) return null;
  const onward = nextOf(graph, id) ?? graph.chapters[at.c].scenes[at.s + 1]?.id ?? graph.chapters[at.c].scenes[at.s - 1].id;
  graph.chapters[at.c].scenes.splice(at.s, 1);
  const repoint = (next: Next | undefined): Next | undefined =>
    next === undefined
      ? undefined
      : typeof next === "string"
        ? next === id
          ? onward
          : next
        : next.map((b) => (b.to === id ? { ...b, to: onward } : b));
  for (const scene of graph.chapters.flatMap((c) => c.scenes)) {
    if (scene.kind === "choice") scene.options = scene.options.map((o) => (o.to === id ? { ...o, to: onward } : o));
    else if (scene.kind !== "ending") scene.next = repoint(scene.next);
  }
  if (graph.layout) delete graph.layout[id];
  const keys = { ...draft.keys };
  delete keys[id];
  return { graph, keys };
}

/** Moves a scene one place up or down in its chapter's play order. */
export function moveScene(draft: Draft, id: string, by: -1 | 1): Draft {
  const graph = structuredClone(draft.graph);
  const at = where(graph, id);
  if (!at) return draft;
  const scenes = graph.chapters[at.c].scenes;
  const to = at.s + by;
  if (to < 0 || to >= scenes.length) return draft;
  [scenes[at.s], scenes[to]] = [scenes[to], scenes[at.s]];
  return { graph, keys: draft.keys };
}

export type Edge = { from: string; to: string; kind: "main" | "choice" | "condition"; slot: number; slots: number };

/** The arrows of the graph: plain transitions (written or by play order), choice options, conditional branches. */
export function edges(graph: Campaign): Edge[] {
  const out: Edge[] = [];
  const all = graph.chapters.flatMap((c) => c.scenes);
  all.forEach((scene, i) => {
    if (scene.kind === "ending") return;
    if (scene.kind === "choice") {
      scene.options.forEach((o, slot) => out.push({ from: scene.id, to: o.to, kind: "choice", slot, slots: scene.options.length }));
      return;
    }
    if (Array.isArray(scene.next)) {
      scene.next.forEach((b, slot) => out.push({ from: scene.id, to: b.to, kind: "condition", slot, slots: scene.next!.length }));
      return;
    }
    const to = typeof scene.next === "string" ? scene.next : all[i + 1]?.id;
    if (to) out.push({ from: scene.id, to, kind: "main", slot: 0, slots: 1 });
  });
  return out;
}

export const NODE_W = 208;
export const NODE_H = 96;
export const GRID = 28;

/** Where each scene is drawn: its saved place, else a column by how far it is from the start. */
export function positions(graph: Campaign): Record<string, { x: number; y: number }> {
  const all = graph.chapters.flatMap((c) => c.scenes);
  const depth = new Map<string, number>();
  const start = all[0]?.id;
  if (start) {
    depth.set(start, 0);
    const queue = [start];
    const links = edges(graph);
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of links) {
        if (e.from !== id || depth.has(e.to)) continue;
        depth.set(e.to, depth.get(id)! + 1);
        queue.push(e.to);
      }
    }
  }
  let unreached = Math.max(0, ...depth.values()) + 1;
  const rows = new Map<number, number>();
  const out: Record<string, { x: number; y: number }> = {};
  for (const scene of all) {
    const col = depth.get(scene.id) ?? unreached++;
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    out[scene.id] = graph.layout?.[scene.id] ?? { x: 40 + col * (NODE_W + 48), y: 40 + row * (NODE_H + 56) };
  }
  return out;
}

/** The problems the validator names for a scene (it writes "<campaign>@<v>: <scene id> ..."). */
export function problemsOf(problems: string[], id: string): string[] {
  const word = new RegExp(`(^|[\\s(])${id.replace(/[-]/g, "\\-")}([\\s:,)]|$)`);
  return problems.filter((p) => word.test(p.replace(/^[^:]+:\s*/, "")));
}
