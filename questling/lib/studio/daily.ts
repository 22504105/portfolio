import type { DailyEntry as StudentDaily } from "@/lib/content/daily";
import type { Text } from "@/lib/content/text";
import { dayNumber } from "@/lib/game/time";
import type { DailyContent } from "./model";

// A teacher's word, fact and quiz of the day (setDaily) as the student's daily discovery shows it
// (lib/content/daily.ts), and its quiz key, which stays on the server. The English is the lesson;
// the fact's explanation is the translation the student can switch to. The teacher's source note
// is for teachers: the student sees the mentor's name in its place.

export const teacherDailyId = (entryId: string) => `t-${entryId}`;

export function studentDaily(entryId: string, day: string, content: DailyContent, cefr: string, mentor: string): StudentDaily {
  const english = `${content.fact.title} — ${content.fact.text}`;
  return {
    id: teacherDailyId(entryId),
    word: {
      text: content.word.text,
      ipa: content.word.ipa,
      partOfSpeech: { ru: "", en: "" },
      translation: content.word.translation,
      example: content.word.example,
      exampleTranslation: { ru: "", en: "" },
      cefr,
    },
    quiz: {
      phrase: content.quiz.question,
      options: content.quiz.options.map((o) => ({ id: o.id, text: { ru: o.text, en: o.text } })),
      xp: 15,
    },
    fact: { text: { ru: content.fact.explanation.ru, en: english }, source: mentor, archive: (((dayNumber(day) % 900) + 900) % 900) + 100 },
  };
}

export function teacherDailyKey(content: DailyContent): { correct: string; explanation: Text } {
  const right = content.quiz.options.find((o) => o.id === content.quiz.correct)?.text ?? "";
  return { correct: content.quiz.correct, explanation: { ru: `Правильный ответ: «${right}».`, en: `The right answer: “${right}”.` } };
}
