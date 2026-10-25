import type { CampaignKeys } from "@/lib/story/graph";

// Answer keys of "Башня Эха": server and demo only, never a signed-in student's page.

export const echoTowerKeys: CampaignKeys = {
  "e-wind": {
    kind: "question",
    correct: "person",
    explanations: {
      person: {
        ru: "Окна заперты изнутри, колокол слишком тяжёл для ветра: звонил человек.",
        en: "The windows are locked inside and the bell is too heavy for wind: a person rang it.",
      },
      wind: {
        ru: "«Far too heavy for the wind to move» — ветер не мог его сдвинуть.",
        en: "“Far too heavy for the wind to move”: the wind could not do it.",
      },
      outside: {
        ru: "Окна заперты изнутри — снаружи до колокола не добраться.",
        en: "The windows are locked inside: nobody outside could reach the bell.",
      },
    },
    grimoire: "too",
  },
  "e-cipher": {
    kind: "puzzle",
    order: ["The bell", "has", "not", "rung", "for a hundred years"],
    explanation: {
      ru: "The bell has not rung for a hundred years — колокол молчал сто лет.",
      en: "“The bell has not rung for a hundred years.”",
    },
    grimoire: "has",
  },
  "e-tense": {
    kind: "question",
    correct: "had",
    explanations: {
      had: {
        ru: "Стражник уснул раньше, чем зазвонил колокол: had fallen asleep.",
        en: "He fell asleep before the bell rang: had fallen asleep.",
      },
      has: {
        ru: "Present Perfect связан с настоящим, а здесь рассказ о прошлом.",
        en: "The Present Perfect is linked to now; this story is in the past.",
      },
      falls: { ru: "Present Simple — о привычках, а не о событии той ночи.", en: "The Present Simple is for habits, not for that night." },
    },
    grimoire: "had",
  },
  "e-proof": {
    kind: "evidence",
    correct: ["guard-confession", "dusty-footprints"],
    explanations: {
      "guard-confession": {
        ru: "Стражник сам признал, что уснул и дверь открыли.",
        en: "The guard himself admitted he slept and the door was opened.",
      },
      "dusty-footprints": { ru: "Следы на лестнице ведут вверх: кто-то вошёл.", en: "The footprints lead up the stairs: someone went in." },
      "closed-windows": {
        ru: "Окна говорят, что это не ветер, но не о том, кто вошёл в дверь.",
        en: "The windows rule out the wind, but say nothing of who came through the door.",
      },
      "old-bell": {
        ru: "Табличка рассказывает историю колокола, а не о ночном госте.",
        en: "The plate tells the bell's history, not about tonight's visitor.",
      },
    },
    grimoire: "show",
  },
  "a-cond": {
    kind: "question",
    correct: "slept",
    explanations: {
      slept: {
        ru: "Третий условный тип — о нереальном: на самом деле стражник уснул, и вор вошёл.",
        en: "The third conditional is unreal: really, the guard slept and the thief came in.",
      },
      awake: { ru: "«If he had stayed awake» — значит, он не остался бодрствовать.", en: "“If he had stayed awake” means he did not." },
      thief: { ru: "Фраза о стражнике, а не о воре.", en: "The sentence is about the guard, not the thief." },
    },
    grimoire: "would",
  },
  "a-cipher": {
    kind: "puzzle",
    order: ["Whoever", "reads", "the book", "controls", "the archive"],
    explanation: {
      ru: "Whoever reads the book controls the archive — кто читает книгу, тот управляет архивом.",
      en: "“Whoever reads the book controls the archive.”",
    },
    grimoire: "Whoever",
  },
  "a-reported": {
    kind: "question",
    correct: "never",
    explanations: {
      never: {
        ru: "had never let (в пересказе) ← have never let (её слова).",
        en: "had never let (reported) ← have never let (her words).",
      },
      will: {
        ru: "Это обещание о будущем, а она говорила о прошлом.",
        en: "That is a promise about the future; she spoke about the past.",
      },
      yesterday: { ru: "Это противоположно тому, что она сказала.", en: "That is the opposite of what she said." },
    },
    grimoire: "had",
  },
  "a-proof": {
    kind: "evidence",
    correct: ["ink-stain"],
    explanations: {
      "ink-stain": {
        ru: "Фиолетовыми чернилами пишут только архивариусы: вор — свой.",
        en: "Only archivists use violet ink: the thief is one of them.",
      },
      "torn-page": { ru: "Страница говорит, что искал вор, но не кто он.", en: "The page shows what the thief wanted, not who it was." },
      "closed-windows": { ru: "Окна — улика из башни, не из архива.", en: "The windows are a clue from the tower, not the archive." },
      "old-bell": { ru: "Табличка — о колоколе, не о воре.", en: "The plate is about the bell, not the thief." },
    },
    grimoire: "must",
  },
};
