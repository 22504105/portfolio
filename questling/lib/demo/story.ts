import type { Locale } from "@/lib/i18n";
import type { QuestionKey, QuestionNode } from "@/lib/story/types";

// Demo content: clue 2 of chapter II of "Тайна забытой башни", as on the approved
// story-player screens. Russian texts come from those screens; the tower explanation is
// written for the demo (no screen shows that option being chosen). The English texts are
// their translation. The clue and the answers are English in both: they are the lesson.

type DemoStory = {
  question: QuestionNode;
  key: QuestionKey;
  /** The clue in the interface language, shown on request after a wrong answer. */
  clueTranslation: string;
};

const nodeId = "tower-ch2-clue2";

export function demoStory(locale: Locale): DemoStory {
  const ru = locale === "ru";
  return {
    question: {
      id: nodeId,
      kind: "question",
      chapter: ru ? "Глава II" : "Chapter II",
      cefr: "A2",
      storyTitle: ru ? "Тайна забытой башни" : "The Secret of the Forgotten Tower",
      location: ru ? "Библиотека теней" : "Library of Shadows",
      image: "/images/shadow-library.webp",
      clue: {
        index: 2,
        total: 5,
        text: "Look for the room where the moon never shines.",
        title: ru ? "Запечатанное письмо" : "The Sealed Letter",
      },
      prompt: ru
        ? { lead: "В библиотеке найдено запечатанное письмо.", task: "Прочитай его и найди верную подсказку." }
        : { lead: "A sealed letter was found in the library.", task: "Read it and find the right clue." },
      options: [
        { id: "cellar", label: "The cellar", gloss: ru ? "Подземелье без окон" : "An underground room with no windows", icon: "stairs" },
        { id: "garden", label: "The garden", gloss: ru ? "Сад академии" : "The academy garden", icon: "park" },
        { id: "tower", label: "The tower", gloss: ru ? "Астрономический шпиль" : "The astronomy spire", icon: "fort" },
      ],
      maxAttempts: 2,
      reward: { xp: 50 },
    },
    key: {
      nodeId,
      correctOptionId: "cellar",
      explanations: ru
        ? {
            cellar: "«Подземелье без окон — глубоко под башней, куда лунный свет никогда не проникает.»",
            garden: "«В саду лунный свет падает прямо на кроны деревьев и тропы. Это не то место.»",
            tower: "«Шпиль открыт небу: луна заглядывает в его окна каждую ночь. Это не то место.»",
          }
        : {
            cellar: "“A room with no windows, deep under the tower, where moonlight never reaches.”",
            garden: "“In the garden the moonlight falls straight onto the trees and paths. This is not the place.”",
            tower: "“The spire is open to the sky: the moon looks through its windows every night. This is not the place.”",
          },
      hint: ru
        ? {
            topic: "Лексика",
            text: "Обратите внимание на отрицательное наречие «never» (никогда). Подумайте, в каком именно помещении замка совершенно нет окон?",
          }
        : {
            topic: "Vocabulary",
            text: "Notice the negative adverb «never». Which room of the castle has no windows at all?",
          },
    },
    // Russian wording from 05_story_player_4; in English, the clue in plainer words.
    clueTranslation: ru ? "Ищите комнату, где никогда не светит луна." : "Find the room that moonlight never reaches.",
  };
}
