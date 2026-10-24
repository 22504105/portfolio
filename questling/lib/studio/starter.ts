import type { Campaign, CampaignKeys } from "@/lib/story/graph";
import type { Cefr } from "./model";

// What a new campaign starts as in the builder: one chapter that is already a sound story — a scene,
// a question and an ending — so the teacher edits something that works instead of an empty page.

export function starterCampaign(slug: string, title: string, cefr: Cefr): { graph: Campaign; keys: CampaignKeys } {
  const t = (ru: string, en: string) => ({ ru, en });
  const graph: Campaign = {
    id: slug,
    version: 1,
    title: t(title, title),
    cefr,
    requires: null,
    quote: { text: t("", ""), source: t("", "") },
    caseNumber: 1,
    clues: [
      {
        id: "first-clue",
        title: t("Первая улика", "The first clue"),
        english: "The First Clue",
        location: t("Библиотека", "The library"),
        image: "/images/sealed-letter.webp",
        description: t("Опишите, что нашёл ученик.", "Describe what the student found."),
        phrase: { text: "The answer is in the library.", glosses: [] },
        tags: [],
        deduction: t("Что из этого следует?", "What does it tell us?"),
        teaser: t("Её найдёт тот, кто ответит верно", "Found by whoever answers right"),
        onward: t("Дальше", "Onward"),
      },
    ],
    chapters: [
      {
        id: "chapter-1",
        label: t("Глава I", "Chapter I"),
        labelAccusative: t("Главу I", "Chapter I"),
        title: t(title, title),
        subtitle: t("Новая глава", "A new chapter"),
        cefr,
        minutes: 5,
        image: "/images/grand-library.webp",
        icon: "menu_book",
        description: t("Опишите главу для ученика.", "Describe the chapter for the student."),
        skills: t("Reading", "Reading"),
        mission: t("Найти первую улику.", "Find the first clue."),
        words: [],
        reward: { xp: 50, coins: 10 },
        scenes: [
          {
            kind: "narration",
            id: "start",
            location: t("Библиотека", "The library"),
            image: "/images/grand-library.webp",
            text: "You open the door of the old library.",
            translation: t("Ты открываешь дверь старой библиотеки.", "You open the old library's door."),
          },
          {
            kind: "question",
            id: "question-1",
            location: t("Библиотека", "The library"),
            image: "/images/shadow-library.webp",
            parchment: "The book is on the table.",
            translation: t("Книга на столе.", "The book is on the table."),
            prompt: { lead: t("Прочитай записку.", "Read the note."), task: t("Где книга?", "Where is the book?") },
            options: [
              { id: "table", label: "On the table", gloss: t("На столе", "On the table"), icon: "local_library" },
              { id: "floor", label: "On the floor", gloss: t("На полу", "On the floor"), icon: "stairs" },
            ],
            maxAttempts: 2,
            xp: 50,
            hint: { topic: t("Лексика", "Vocabulary"), text: t("«On» — «на».", "«On» means on top of.") },
            grimoire: {
              title: t("Гримуар «On»", "The grimoire of «On»"),
              minutes: 1,
              rule: {
                heading: t("Предлог места:", "A preposition of place:"),
                formula: "[ON] the table",
                text: t("«On» — на поверхности.", "«On» means on a surface."),
              },
              deduction: t("Записка говорит «on the table».", "The note says “on the table”."),
              quiz: { sentence: "The cat is ___ the chair.", options: ["on", "of", "at"] },
            },
            clue: "first-clue",
          },
          {
            kind: "ending",
            id: "ending",
            location: t("Библиотека", "The library"),
            image: "/images/grand-library.webp",
            title: t("Конец главы", "The end of the chapter"),
            text: "You found the book. The mystery begins.",
            translation: t("Ты нашёл книгу. Тайна начинается.", "You found the book. The mystery begins."),
            tone: "bright",
            reward: { xp: 50, coins: 10 },
          },
        ],
      },
    ],
  };
  const keys: CampaignKeys = {
    "question-1": {
      kind: "question",
      correct: "table",
      explanations: {
        table: t("Верно: on the table.", "Right: on the table."),
        floor: t("В записке — on the table.", "The note says on the table."),
      },
      grimoire: "on",
    },
  };
  return { graph, keys };
}
