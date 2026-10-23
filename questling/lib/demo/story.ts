import type { QuestionKey, QuestionNode } from "@/lib/story/types";

// Demo content: clue 2 of chapter II of "Тайна забытой башни", as on the approved
// story-player screens. Texts come from those screens; the tower explanation is
// written for the demo (no screen shows that option being chosen).

export const demoQuestion: QuestionNode = {
  id: "tower-ch2-clue2",
  kind: "question",
  chapter: "Глава II",
  cefr: "A2",
  storyTitle: "Тайна забытой башни",
  location: "Библиотека теней",
  image: "/images/shadow-library.webp",
  clue: { index: 2, total: 5, text: "Look for the room where the moon never shines.", title: "Запечатанное письмо" },
  prompt: { lead: "В библиотеке найдено запечатанное письмо.", task: "Прочитай его и найди верную подсказку." },
  options: [
    { id: "cellar", label: "The cellar", gloss: "Подземелье без окон", icon: "stairs" },
    { id: "garden", label: "The garden", gloss: "Сад академии", icon: "park" },
    { id: "tower", label: "The tower", gloss: "Астрономический шпиль", icon: "fort" },
  ],
  maxAttempts: 2,
  reward: { xp: 50 },
};

export const demoQuestionKey: QuestionKey = {
  nodeId: "tower-ch2-clue2",
  correctOptionId: "cellar",
  explanations: {
    cellar: "«Подземелье без окон — глубоко под башней, куда лунный свет никогда не проникает.»",
    garden: "«В саду лунный свет падает прямо на кроны деревьев и тропы. Это не то место.»",
    tower: "«Шпиль открыт небу: луна заглядывает в его окна каждую ночь. Это не то место.»",
  },
  hint: {
    topic: "Лексика",
    text: "Обратите внимание на отрицательное наречие «never» (никогда). Подумайте, в каком именно помещении замка совершенно нет окон?",
  },
};

/** The clue in Russian, shown on request after a wrong answer (wording from 05_story_player_4). */
export const demoClueTranslation = "Ищите комнату, где никогда не светит луна.";
