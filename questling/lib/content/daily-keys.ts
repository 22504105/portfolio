import type { Text } from "./text";

// Right answers of the daily word quizzes. Like quick-quest-keys.ts: server and demo only.

export const dailyQuizKeys: Record<string, { correct: string; explanation: Text }> = {
  whisper: {
    correct: "b",
    explanation: { ru: "Whisper — шептать: она прошептала шифр.", en: "To whisper is to say something very softly." },
  },
  lantern: { correct: "a", explanation: { ru: "Bring — принести, lantern — фонарь.", en: "Bring means take something with you." } },
  clue: {
    correct: "a",
    explanation: {
      ru: "No clue — ни одной зацепки (и «понятия не имеем»).",
      en: "“No clue” means nothing that helps (and also “no idea”).",
    },
  },
  brave: { correct: "a", explanation: { ru: "Brave — храбрый.", en: "Brave means not afraid." } },
  ancient: {
    correct: "c",
    explanation: { ru: "Ancient — древний, spell — заклинание.", en: "Ancient means very old; a spell is magic words." },
  },
  hidden: { correct: "b", explanation: { ru: "Hidden — скрытый, message — послание.", en: "Hidden means out of sight." } },
  journey: {
    correct: "a",
    explanation: { ru: "Have a safe journey — счастливого пути.", en: "People say it to someone who is leaving on a trip." },
  },
};
