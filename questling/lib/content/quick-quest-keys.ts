import type { QuestionKey } from "@/lib/learning/questions";

// Answer keys of the quick quests: graded on the server for signed-in students,
// in the browser only for the demo. Never import this into a signed-in student's page.

export const quickQuestKeys: Record<string, Record<string, QuestionKey>> = {
  letter: {
    seal: {
      kind: "choice",
      correct: "sealed",
      explanation: {
        ru: "Sealed — «запечатано»: печать не даёт открыть письмо.",
        en: "Sealed means closed with a seal, so nobody can open it unnoticed.",
      },
    },
    candle: {
      kind: "fill",
      correct: "candle",
      explanation: { ru: "By the light of a candle — «при свете свечи».", en: "“By the light of a candle”: a candle gives light." },
    },
    words: {
      kind: "match",
      correct: { letter: "письмо", seal: "печать", secret: "тайна" },
      explanation: { ru: "letter — письмо, seal — печать, secret — тайна.", en: "letter, seal and secret: the three words of the quest." },
    },
  },
  mist: {
    went: {
      kind: "fill",
      correct: "went",
      explanation: { ru: "Go — неправильный глагол: go → went.", en: "Go is irregular: go → went." },
    },
    question: {
      kind: "order",
      correct: ["Did", "you", "find", "the", "key"],
      explanation: { ru: "Вопрос в Past Simple: Did + подлежащее + глагол.", en: "A Past Simple question: Did + subject + verb." },
    },
    saw: {
      kind: "choice",
      correct: "b",
      explanation: { ru: "Last night — прошлое, значит see → saw.", en: "Last night is the past, so see → saw." },
    },
  },
  raven: {
    where: {
      kind: "choice",
      correct: "bridge",
      explanation: { ru: "«…at the old crossroads, near the broken bridge».", en: "“…at the old crossroads, near the broken bridge”." },
    },
    when: {
      kind: "choice",
      correct: "midnight",
      explanation: { ru: "«…at midnight, when the bell rings twelve times».", en: "“…at midnight, when the bell rings twelve times”." },
    },
    bring: {
      kind: "multi",
      correct: ["lantern", "key"],
      explanation: { ru: "Ворон просит фонарь и ключ.", en: "The raven asks for a lantern and a key." },
    },
  },
  stars: {
    under: {
      kind: "fill",
      correct: "under",
      explanation: { ru: "Under — «под».", en: "Under: below something." },
    },
    between: {
      kind: "choice",
      correct: "between",
      explanation: { ru: "Between — «между двумя».", en: "Between: in the middle of two things." },
    },
    sentence: {
      kind: "order",
      correct: ["The", "map", "is", "on", "the", "wall"],
      explanation: { ru: "Подлежащее, глагол, предлог места.", en: "Subject, verb, then the place." },
    },
  },
  runes: {
    door: {
      kind: "order",
      correct: ["Open", "the", "door", "slowly"],
      explanation: { ru: "Повелительное наклонение начинается с глагола.", en: "An instruction starts with the verb." },
    },
    owl: {
      kind: "order",
      correct: ["The", "owl", "flies", "at", "night"],
      explanation: { ru: "Подлежащее, глагол, обстоятельство времени.", en: "Subject, verb, then the time." },
    },
    opposites: {
      kind: "match",
      correct: { dark: "light", open: "closed", old: "new" },
      explanation: { ru: "dark — light, open — closed, old — new.", en: "dark — light, open — closed, old — new." },
    },
  },
  bells: {
    who: {
      kind: "choice",
      correct: "librarian",
      explanation: { ru: "«…the old librarian climbs the stairs…».", en: "“…the old librarian climbs the stairs…”." },
    },
    stairs: {
      kind: "fill",
      correct: "stairs",
      explanation: { ru: "Climb the stairs — «подниматься по лестнице».", en: "You climb the stairs to the top of a tower." },
    },
    often: {
      kind: "choice",
      correct: "evening",
      explanation: { ru: "«Every evening…» — каждый вечер.", en: "“Every evening…”." },
    },
  },
  scroll: {
    why: {
      kind: "choice",
      correct: "roof",
      explanation: { ru: "«…because the roof is broken».", en: "“…because the roof is broken”." },
    },
    when: {
      kind: "choice",
      correct: "monday",
      explanation: { ru: "«It will open again on Monday».", en: "“It will open again on Monday”." },
    },
    box: {
      kind: "fill",
      correct: "box",
      explanation: { ru: "«…return your books to the box by the door».", en: "“…return your books to the box by the door”." },
    },
  },
};
